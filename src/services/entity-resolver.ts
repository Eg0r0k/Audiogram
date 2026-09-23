import { db } from "@/db";
import {
  TrackState,
  type TrackSource,
  type AlbumEntity,
  type ArtistEntity,
  type PinnedFlag,
  type TrackEntity,
} from "@/db/entities";
import { identityKey, splitArtistNames } from "@/lib/artist-names";
import { AlbumId, ArtistId } from "@/types/ids";
import { parseTrackRef, remoteTrackSource, sourceKindOfId } from "@/types/track-ref";
import type { SourceTrackDTO } from "@/types/source-dto";
import type { BaseMetadata } from "@/workers/types";

//
// ── Remote pin cascade ────────────────────────────────────────────────────────
//
// Adding a remote track to the library upserts its album/artist rows under
// the same deterministic prefixed ids ("nd:<albumId>" / "nd:<artistId>").
// A shadow pin (playback, likes, playlists) writes the track row alone: its
// albumId/artistIds are links to the source's catalog, not to Dexie rows.
// Pure derivation lives here; the write goes through unitOfWork in
// ensurePinned.
//

// The naming rules moved to `@/lib/artist-names`; re-exported so existing
// importers of this module keep working.
export { identityKey, splitArtistNames };

export interface RemotePinExisting {
  track?: TrackEntity;
  album?: AlbumEntity;
  artists: ReadonlyMap<ArtistId, ArtistEntity>;
}

export interface RemotePinRows {
  track: TrackEntity;
  album: AlbumEntity | null;
  artists: ArtistEntity[];
}

/** A shadow row never downgrades an existing full library member. */
function mergePinned(existing: PinnedFlag | undefined, requested: PinnedFlag): PinnedFlag {
  return existing === 1 ? 1 : requested;
}

function trackSourceOf(dto: SourceTrackDTO): TrackSource {
  const ref = parseTrackRef(dto.id);
  if (ref.kind === "local") throw new Error(`Not a remote track id: ${dto.id}`);
  return remoteTrackSource(ref.kind);
}

/**
 * Best-effort per-artist names: the DTO only carries a joined display string,
 * so split it when the parts line up with the id list; otherwise the first
 * row gets the display name. `alignArtists` makes them line up before the
 * cascade runs; this fallback covers DTOs that skipped it.
 */
function artistNamesFor(dto: SourceTrackDTO, ids: ArtistId[]): (string | undefined)[] {
  const parts = splitArtistNames(dto.artistName);
  if (parts.length === ids.length) return parts;
  return ids.map((_, index) => (index === 0 ? dto.artistName : undefined));
}

/**
 * Builds the merged track, plus album/artist rows for a library member, for
 * pinning a remote DTO. Snapshot fields come from the DTO
 * (revalidate-on-view semantics); user state on existing rows (likes,
 * counts, tags, addedAt) is preserved.
 */
export function buildRemoteShadowEntities(
  dto: SourceTrackDTO,
  requestedPinned: PinnedFlag,
  existing: RemotePinExisting,
  now: number,
): RemotePinRows {
  const source = trackSourceOf(dto);
  const pinned = mergePinned(existing.track?.pinned, requestedPinned);
  // Same rule as for artists below: an album row we cannot title would show
  // up as a blank entry in the album picker, so the track stays album-less.
  const requestedAlbumId = dto.albumId ?? existing.track?.albumId ?? AlbumId("");
  const albumTitle = dto.albumTitle || existing.album?.title || existing.track?.albumTitle || "";
  const albumId = albumTitle ? requestedAlbumId : AlbumId("");

  const candidateIds = dto.artistIds ?? existing.track?.artistIds ?? [];
  const names = artistNamesFor(dto, candidateIds);
  const artists: ArtistEntity[] = [];
  // A shadow row gets no album/artist rows: its ids are links, and the rows
  // appear once the track joins the library.
  for (const [index, id] of (pinned === 1 ? candidateIds : []).entries()) {
    const current = existing.artists.get(id);
    const name = current?.name || names[index];
    // No name from any source: an empty artist row renders as a blank entry
    // in the library and never heals — dropping the id is the lesser evil.
    if (!name) continue;
    artists.push({
      ...current,
      id,
      name,
      pinned: 1,
      addedAt: current?.addedAt ?? now,
      updatedAt: now,
    });
  }
  const artistIds = pinned === 1 ? artists.map(artist => artist.id) : [...candidateIds];

  const track: TrackEntity = {
    ...existing.track,
    id: dto.id,
    title: dto.title,
    artistName: dto.artistName ?? existing.track?.artistName ?? "",
    albumTitle,
    artistIds,
    albumId,
    tagIds: existing.track?.tagIds ?? [],
    source,
    pinned,
    state: existing.track?.state ?? TrackState.READY,
    duration: dto.duration ?? existing.track?.duration ?? 0,
    format: dto.format ?? existing.track?.format ?? {},
    trackNo: dto.trackNo ?? existing.track?.trackNo,
    diskNo: dto.discNo ?? existing.track?.diskNo,
    playCount: existing.track?.playCount ?? 0,
    addedAt: existing.track?.addedAt ?? now,
  };

  const album: AlbumEntity | null = pinned === 1 && dto.albumId && albumId
    ? {
        ...existing.album,
        id: dto.albumId,
        title: albumTitle,
        artistId: existing.album?.artistId ?? (artistIds.length > 0 ? artistIds[0] : ArtistId("")),
        pinned: 1,
        addedAt: existing.album?.addedAt ?? now,
        updatedAt: now,
      }
    : null;

  return { track, album, artists };
}

/**
 * Remote pin cascade, artist identity. The DTO carries a joined display
 * string and, when the source knows them, artist ids — and the two need not
 * agree: a video row knows one channel name, YT Music files a collab as one
 * "A & B" entity, a provider may have no id for a credited artist at all.
 * Every name from `splitArtistNames` resolves to exactly one id, in order:
 *
 * 1. a same-named LOCAL artist — a YT/ND download never duplicates one the
 *    library already has (matching is the import pipeline's identity);
 * 2. the source's own id, when the ids line up one-to-one with the names;
 * 3. a same-named row of the same source (never another source's);
 * 4. a fresh local row - only when `createMissing`, i.e. for a library
 *    member. A shadow pin writes no artist rows, so an unresolved name
 *    leaves the DTO as the source gave it.
 *
 * The result has one id per name and the display string re-joined with
 * ", ", so the cascade and the row's caption agree on who the artists are.
 */
/**
 * Name → artist id, in the two buckets alignArtists resolves through. Built
 * once and grown as rows appear, because a batch aligns every track against
 * the whole artists table: rebuilt per track it scales with the library
 * rather than with the batch.
 *
 * Shadow buckets are per source prefix and filled on first use — a batch
 * normally comes from one source, so that is one extra walk, not one per
 * track. First name wins in both buckets, matching insertion order.
 */
class ArtistNameIndex {
  private readonly locals = new Map<string, ArtistId>();
  private readonly remote: ArtistEntity[] = [];
  private readonly shadowsByPrefix = new Map<string, Map<string, ArtistId>>();

  constructor(artists: readonly ArtistEntity[]) {
    for (const artist of artists) this.add(artist);
  }

  add(artist: ArtistEntity): void {
    if (sourceKindOfId(artist.id) === "local") {
      const key = identityKey(artist.name);
      if (!this.locals.has(key)) this.locals.set(key, artist.id);
      return;
    }
    this.remote.push(artist);
    for (const [prefix, bucket] of this.shadowsByPrefix) {
      if (artist.id.startsWith(prefix)) this.fill(bucket, artist);
    }
  }

  local(key: string): ArtistId | undefined {
    return this.locals.get(key);
  }

  ownShadow(key: string, ownPrefix: string): ArtistId | undefined {
    return this.shadowsFor(ownPrefix).get(key);
  }

  private fill(bucket: Map<string, ArtistId>, artist: ArtistEntity): void {
    const key = identityKey(artist.name);
    if (!bucket.has(key)) bucket.set(key, artist.id);
  }

  private shadowsFor(prefix: string): Map<string, ArtistId> {
    const cached = this.shadowsByPrefix.get(prefix);
    if (cached) return cached;

    const bucket = new Map<string, ArtistId>();
    for (const artist of this.remote) {
      if (artist.id.startsWith(prefix)) this.fill(bucket, artist);
    }
    this.shadowsByPrefix.set(prefix, bucket);
    return bucket;
  }
}

export type { ArtistNameIndex };

export const artistNameIndex = (artists: readonly ArtistEntity[]): ArtistNameIndex =>
  new ArtistNameIndex(artists);

export function alignArtists(
  dto: SourceTrackDTO,
  index: ArtistNameIndex,
  { createMissing = true }: { createMissing?: boolean } = {},
): SourceTrackDTO {
  const names = splitArtistNames(dto.artistName);
  if (names.length === 0) return dto;

  const remoteIds = dto.artistIds ?? [];
  const paired = remoteIds.length === names.length;
  const ownPrefix = `${parseTrackRef(dto.id).kind}:`;

  const resolved = names.map((name, position) => {
    const key = identityKey(name);
    return index.local(key)
      ?? (paired ? remoteIds[position] : undefined)
      ?? index.ownShadow(key, ownPrefix);
  });

  // Without rule 4 a name may stay unresolved, and a partial list would put
  // ids under the wrong names; the source's own ids are what its row showed.
  if (!createMissing && resolved.some(id => id === undefined)) return dto;

  const artistIds = resolved.map(id => id ?? ArtistId(crypto.randomUUID()));
  return { ...dto, artistIds, artistName: names.join(", ") };
}

type AlbumCacheKey = `${ArtistId}::${string}`;

function albumKey(artistId: ArtistId, albumTitle: string): AlbumCacheKey {
  return `${artistId}::${identityKey(albumTitle)}`;
}

interface AlbumEntry {
  id: AlbumId;
  isNew: boolean;
}

export class EntityResolver {
  private readonly artists = new Map<string, ArtistId>();
  private readonly albums = new Map<AlbumCacheKey, AlbumEntry>();

  async resolve(metas: BaseMetadata[]): Promise<void> {
    await this.resolveArtists(metas);
    await this.resolveAlbums(metas);
  }

  getArtistId(name: string): ArtistId | undefined {
    return this.artists.get(identityKey(name));
  }

  getAlbumEntry(artistId: ArtistId, albumTitle: string): AlbumEntry | undefined {
    return this.albums.get(albumKey(artistId, albumTitle));
  }

  getArtistIds(meta: BaseMetadata): ArtistId[] {
    return meta.artists
      .filter(name => name.trim())
      .map(name => this.artists.get(identityKey(name)))
      .filter((id): id is ArtistId => !!id);
  }

  private async resolveArtists(metas: BaseMetadata[]): Promise<void> {
    const uniqueKeys = [
      ...new Set(
        metas.flatMap(m => m.artists).filter(a => a.trim()).map(identityKey),
      ),
    ];

    if (uniqueKeys.length === 0) return;

    const existing = await db.artists.toArray();
    const wanted = new Set(uniqueKeys);
    // A local row always wins over a same-named remote row: downloads must
    // join the library's own artist, never one added from a source.
    for (const artist of existing) {
      const key = identityKey(artist.name);
      if (!wanted.has(key)) continue;
      const current = this.artists.get(key);
      const isLocal = sourceKindOfId(artist.id) === "local";
      if (!current || (isLocal && sourceKindOfId(current) !== "local")) {
        this.artists.set(key, artist.id);
      }
    }

    for (const key of uniqueKeys) {
      if (!this.artists.has(key)) {
        this.artists.set(key, ArtistId(crypto.randomUUID()));
      }
    }
  }

  private async resolveAlbums(metas: BaseMetadata[]): Promise<void> {
    const knownArtistIds = [
      ...new Set(
        metas.flatMap(m => m.artists)
          .map(name => name && this.artists.get(identityKey(name)))
          .filter((id): id is ArtistId => !!id),
      ),
    ];

    if (knownArtistIds.length === 0) return;

    const existing = await db.albums
      .where("artistId")
      .anyOf(knownArtistIds)
      .toArray();

    for (const album of existing) {
      this.albums.set(
        albumKey(album.artistId, album.title),
        { id: album.id, isNew: false },
      );
    }

    for (const meta of metas) {
      const title = meta.album.trim();
      if (!title || title === "Unknown Album") continue;

      const firstArtistId = meta.artists[0] && this.artists.get(identityKey(meta.artists[0]));
      if (!firstArtistId) continue;

      const key = albumKey(firstArtistId, title);
      if (!this.albums.has(key)) {
        this.albums.set(key, { id: AlbumId(crypto.randomUUID()), isNew: true });
      }
    }
  }
}
