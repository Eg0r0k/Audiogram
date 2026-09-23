import { toRaw } from "vue";
import type { Result } from "neverthrow";
import { db } from "@/db";
import type { ArtistEntity, CoverOwnerType, PinnedFlag } from "@/db/entities";
import { albumRepository, artistRepository, trackRepository } from "@/db/repositories";
import { unitOfWork } from "@/db/unit-of-work";
import { getLogger } from "@/lib/logger";
import { chunk } from "@/lib/math";
import { indexImportedTracks } from "@/modules/search/service/searchIndex";
import type { SourceTrackDTO } from "@/types/source-dto";
import {
  alignArtists,
  artistNameIndex,
  buildRemoteShadowEntities,
  type ArtistNameIndex,
  type RemotePinExisting,
  type RemotePinRows,
} from "@/services/entity-resolver";
import type { Track } from "@/modules/player/types";
import { unwrapResult } from "@/queries/shared";
import type { TrackMenuSubject } from "../components/menu/type";
import { trackCoverOwner } from "@/modules/covers/composables/useTrackCover";
import { mapTrack } from "../lib/mappers";
import { ensureShadowCover } from "./shadowAlbumCover";

/** Subjects per transaction — see the comment on the loop in pinInChunks. */
const PIN_CHUNK_SIZE = 25;

interface RemoteEntry {
  dto: SourceTrackDTO;
  index: number;
}

interface PinnedEntry {
  entry: RemoteEntry;
  rows: RemotePinRows;
}

/**
 * The artists table as the batch sees it, plus the rows it adds. The
 * rows are kept alongside the index only to rebuild it when a transaction
 * aborts — the happy path never walks them again.
 */
interface ArtistSnapshot {
  rows: ArtistEntity[];
  ids: Set<string>;
  index: ArtistNameIndex;
}

interface PinContext {
  snapshot: ArtistSnapshot;
  requestedPinned: PinnedFlag;
  now: number;
}

/**
 * Guarantees a Dexie row for the subject and returns it as a Track: library
 * subjects pass through, remote DTOs run the pin cascade in one unitOfWork:
 * the track row, plus album/artist rows when it is a library member.
 * Idempotent; a shadow request never downgrades an existing pinned = 1 row.
 */
export async function ensurePinned(
  subject: TrackMenuSubject,
  options: { pinned?: PinnedFlag } = {},
): Promise<Track> {
  if (subject.kind === "library") return subject.track;
  if (subject.kind === "ephemeral") {
    throw new Error("Ephemeral tracks have no library identity and cannot be pinned");
  }

  const [track] = await ensurePinnedMany([subject], options);
  return track;
}

/** One subject's cascade. Runs inside the caller's transaction. */
const pinOneRemote = async (entry: RemoteEntry, ctx: PinContext): Promise<PinnedEntry> => {
  const track = await unwrapResult(trackRepository.findById(entry.dto.id));
  const dto = alignArtists(entry.dto, ctx.snapshot.index, {
    createMissing: ctx.requestedPinned === 1 || track?.pinned === 1,
  });
  // The cascade falls back to the row's own artists when the DTO carries none;
  // their current rows must be loaded too, or the upsert would rebuild them
  // from a DTO that knows no names.
  const artistIds = dto.artistIds ?? track?.artistIds ?? [];
  const [album, artists] = await Promise.all([
    dto.albumId ? unwrapResult(albumRepository.findById(dto.albumId)) : Promise.resolve(undefined),
    artistIds.length > 0 ? unwrapResult(artistRepository.findByIds(artistIds)) : Promise.resolve([]),
  ]);

  const existing: RemotePinExisting = {
    track,
    album,
    artists: new Map(artists.map(artist => [artist.id, artist])),
  };
  const built = buildRemoteShadowEntities(dto, ctx.requestedPinned, existing, ctx.now);

  await unwrapResult(trackRepository.upsert(built.track));
  if (built.album) await unwrapResult(albumRepository.upsert(built.album));
  if (built.artists.length > 0) await unwrapResult(artistRepository.upsertMany(built.artists));

  // Only rows the snapshot does not already carry: buildRemoteShadowEntities
  // re-emits existing ones, and a later subject has to match an artist an
  // earlier one introduced.
  for (const artist of built.artists) {
    if (ctx.snapshot.ids.has(artist.id)) continue;
    ctx.snapshot.ids.add(artist.id);
    ctx.snapshot.rows.push(artist);
    ctx.snapshot.index.add(artist);
  }
  return { entry, rows: built };
};

const runPinBatch = async (
  batch: readonly RemoteEntry[],
  ctx: PinContext,
): Promise<Result<PinnedEntry[], Error>> => {
  const artistsBefore = ctx.snapshot.rows.length;
  const result = await unitOfWork.runScoped(
    [db.tracks, db.albums, db.artists],
    async () => {
      const pinned: PinnedEntry[] = [];
      for (const entry of batch) pinned.push(await pinOneRemote(entry, ctx));
      return pinned;
    },
  );

  // An aborted transaction rolled its rows back, so the in-memory snapshot has
  // to follow it: a retried subject must not align onto an artist whose
  // row no longer exists. The index cannot drop entries, so it is rebuilt —
  // only here, on a path a batch does not normally take.
  if (result.isErr() && ctx.snapshot.rows.length > artistsBefore) {
    for (const artist of ctx.snapshot.rows.splice(artistsBefore)) ctx.snapshot.ids.delete(artist.id);
    ctx.snapshot.index = artistNameIndex(ctx.snapshot.rows);
  }
  return result;
};

const pinInChunks = async (
  remote: readonly RemoteEntry[],
  ctx: PinContext,
): Promise<{ pinned: PinnedEntry[]; failures: Error[] }> => {
  const pinned: PinnedEntry[] = [];
  const failures: Error[] = [];

  // Chunked rather than one transaction for the whole batch: IndexedDB cannot
  // run a readwrite transaction concurrently with anything else scoped to the
  // same stores, so a queued album held as one transaction would stall every
  // library read behind it until the last track committed.
  for (const batch of chunk(remote, PIN_CHUNK_SIZE)) {
    const result = await runPinBatch(batch, ctx);
    if (result.isOk()) {
      pinned.push(...result.value);
      continue;
    }
    if (batch.length === 1) {
      failures.push(result.error);
      continue;
    }
    // A transaction aborts whole, so one unwritable row took the chunk's other
    // subjects down with it. Re-run them alone — a transaction each, but only
    // the subject that actually fails is lost.
    for (const entry of batch) {
      const retry = await runPinBatch([entry], ctx);
      if (retry.isOk()) pinned.push(...retry.value);
      else failures.push(retry.error);
    }
  }

  return { pinned, failures };
};

/**
 * Artwork in the background (best-effort). The album owns it when there is
 * one; an album-less track (a YouTube music video) carries it under its own
 * id — the same rule the import pipeline applies to files. One fetch per
 * owner: a whole album's tracks name the same one.
 */
const requestShadowCovers = (pinned: readonly PinnedEntry[]): void => {
  const requests = new Map<string, { ownerType: CoverOwnerType; ownerId: string; coverRef: string }>();
  for (const { entry, rows } of pinned) {
    const coverRef = entry.dto.coverRef;
    if (!coverRef) continue;
    const owner = trackCoverOwner(rows.track);
    if (!owner) continue;
    const key = `${owner.ownerType}:${owner.ownerId}`;
    if (!requests.has(key)) requests.set(key, { ...owner, coverRef });
  }

  for (const { ownerType, ownerId, coverRef } of requests.values()) {
    ensureShadowCover(ownerType, ownerId, coverRef)
      .catch(error => getLogger().warn(`[Covers] Shadow cover for ${ownerId} failed: ${String(error)}`));
  }
};

/**
 * The same cascade for a whole batch — queueing a remote album pins every one
 * of its tracks. The artists table is what makes that expensive: matching a
 * credited name against the local library needs all of it, and read per track
 * it turns "play this album" into O(tracks × artists). Here it is read once
 * and grown in memory as the batch creates artist rows, so a later subject
 * still matches an artist an earlier one introduced.
 *
 * Best-effort over the batch: a subject that cannot be written costs only
 * itself, the way it did when each track pinned on its own. A batch where
 * nothing got through rejects, so a single pin still surfaces its error.
 *
 * Library subjects pass through; an ephemeral one has no library identity and
 * throws, as it does for a single pin.
 */
export async function ensurePinnedMany(
  subjects: readonly TrackMenuSubject[],
  options: { pinned?: PinnedFlag } = {},
): Promise<Track[]> {
  const out = new Array<Track | null>(subjects.length).fill(null);
  const resolved = () => out.filter((track): track is Track => track !== null);
  const remote: RemoteEntry[] = [];

  subjects.forEach((subject, index) => {
    if (subject.kind === "library") {
      out[index] = subject.track;
      return;
    }
    if (subject.kind === "ephemeral") {
      throw new Error("Ephemeral tracks have no library identity and cannot be pinned");
    }
    // DTOs from page composables are deep-reactive Vue proxies; IndexedDB's
    // structured clone rejects proxies (DataCloneError). Unwrap once here.
    remote.push({ dto: toRaw(subject.dto), index });
  });

  if (remote.length === 0) return resolved();

  // A same-named local artist absorbs the remote one, shadow pins included;
  // for a library member, names the source has no id for get a row of their
  // own. Read once, outside the writes.
  const needsArtists = remote.some(({ dto }) => (dto.artistIds ?? []).length > 0 || !!dto.artistName);
  const artistRows = needsArtists ? [...await unwrapResult(artistRepository.findAll())] : [];
  const ctx: PinContext = {
    snapshot: {
      rows: artistRows,
      ids: new Set(artistRows.map(artist => artist.id)),
      index: artistNameIndex(artistRows),
    },
    requestedPinned: options.pinned ?? 1,
    now: Date.now(),
  };

  const { pinned, failures } = await pinInChunks(remote, ctx);

  if (pinned.length === 0 && failures.length > 0) throw failures[0];
  if (failures.length > 0) {
    getLogger().warn(`[Pin] ${failures.length} of ${remote.length} track(s) failed: ${String(failures[0])}`);
  }

  requestShadowCovers(pinned);

  // Best-effort: search sync must not fail the action that triggered the pin.
  if (ctx.requestedPinned === 1) {
    const ids = pinned.map(({ rows }) => rows.track.id);
    indexImportedTracks(ids).catch((error) => {
      getLogger().warn(`[Search] Indexing ${ids.length} pinned track(s) failed: ${String(error)}`);
    });
  }

  for (const { entry, rows } of pinned) {
    out[entry.index] = mapTrack(rows.track, rows.artists, rows.album);
  }
  return resolved();
}
