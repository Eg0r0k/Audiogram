import type { Transaction } from "dexie";
import type { PinnedFlag } from "./entities";
import { sourceKindOfId } from "@/types/track-ref";

/**
 * v10 upgrade transform: every row existing before the multi-source schema is
 * a real library member, so it gets `pinned = 1`. Kept as a standalone
 * function so the transform is unit-testable without IndexedDB.
 */
export function markPinned(row: { pinned?: PinnedFlag }): void {
  row.pinned = 1;
}

/** Minimal slice of Dexie's Transaction the v10 upgrade actually touches. */
export type UpgradeTransaction = Pick<Transaction, "table">;

export async function upgradeToV10(tx: UpgradeTransaction): Promise<void> {
  await Promise.all(
    ["tracks", "albums", "artists"].map(name =>
      tx.table(name).toCollection().modify(markPinned),
    ),
  );
}

/**
 * v12 data normalization — runs BEFORE the v13 index changes because Dexie
 * applies a version's index diff before its upgrade function, and the unique
 * `&[ownerType+ownerId]` of v13 cannot be built over duplicate covers.
 *
 * 1. tracks.artistName / albumTitle: undefined → "". Both are indexed (plain
 *    and inside the [x+likedAt] compounds) and a row with an undefined key
 *    silently drops out of the index — invisible in sorted listings while
 *    still counted.
 * 2. covers: one row per (ownerType, ownerId), the most recently updated wins.
 * 3. albums / artists.pinned: coerce anything that is not 0 to 1 so the new
 *    pinned indexes see every row.
 */
export const backfillTrackNames = (row: { artistName?: string; albumTitle?: string }): void => {
  if (row.artistName === undefined) row.artistName = "";
  if (row.albumTitle === undefined) row.albumTitle = "";
};

export const normalizePinned = (row: { pinned?: unknown }): void => {
  row.pinned = row.pinned === 0 ? 0 : 1;
};

/** Ids to delete so that each (ownerType, ownerId) keeps only its newest cover. */
export const coverDuplicatesToDelete = (
  covers: readonly { id: string; ownerType: string; ownerId: string; updatedAt: number }[],
): string[] => {
  const newest = new Map<string, { id: string; updatedAt: number }>();
  const toDelete: string[] = [];
  for (const cover of covers) {
    const key = `${cover.ownerType}\u0000${cover.ownerId}`;
    const current = newest.get(key);
    if (!current) {
      newest.set(key, cover);
    }
    else if (cover.updatedAt > current.updatedAt) {
      toDelete.push(current.id);
      newest.set(key, cover);
    }
    else {
      toDelete.push(cover.id);
    }
  }
  return toDelete;
};

export const upgradeToV12 = async (tx: UpgradeTransaction): Promise<void> => {
  await tx.table("tracks").toCollection().modify(backfillTrackNames);

  // Walk the compound index by key only — no cover blobs are loaded; the
  // duplicate groups (rare) are then fetched to compare updatedAt.
  const groups = new Map<string, string[]>();
  await tx.table("covers").orderBy("[ownerType+ownerId]").eachKey((key, cursor) => {
    const k = (key as [string, string]).join("\u0000");
    const ids = groups.get(k) ?? [];
    ids.push(cursor.primaryKey as string);
    groups.set(k, ids);
  });
  const duplicatedIds = [...groups.values()].filter(ids => ids.length > 1).flat();
  if (duplicatedIds.length > 0) {
    const rows = (await tx.table("covers").bulkGet(duplicatedIds))
      .filter((row): row is { id: string; ownerType: string; ownerId: string; updatedAt: number } => !!row);
    await tx.table("covers").bulkDelete(coverDuplicatesToDelete(rows));
  }

  await Promise.all(
    ["albums", "artists"].map(name => tx.table(name).toCollection().modify(normalizePinned)),
  );
};

/**
 * v14: albums that were pinned without a title. They came from YT/ND DTOs
 * carrying an album id but no name (the resolver now refuses to create
 * those). Each such album is dissolved: its tracks become album-less, its
 * cover moves to the tracks that have none of their own (album-less tracks
 * own their artwork), then the album and its cover row go.
 */
export const upgradeToV14 = async (tx: UpgradeTransaction): Promise<void> => {
  const blankAlbumIds = (await tx.table("albums").where("title").equals("").primaryKeys()) as string[];
  if (blankAlbumIds.length === 0) return;

  // Only the plain `ownerType` index is used here: [ownerType+ownerId] was
  // re-created (made unique) by v13 in this same versionchange transaction,
  // and querying a just-re-created index in that transaction is not reliable
  // across IndexedDB implementations.
  const coversOf = (ownerType: string, ownerIds: ReadonlySet<string>) =>
    tx.table("covers").where("ownerType").equals(ownerType).filter(cover => ownerIds.has(cover.ownerId));

  const now = Date.now();
  for (const albumId of blankAlbumIds) {
    const trackIds = (await tx.table("tracks").where("albumId").equals(albumId).primaryKeys()) as string[];
    const albumCover = await coversOf("album", new Set([albumId])).first();

    if (albumCover) {
      const owned = new Set(
        (await coversOf("track", new Set(trackIds)).toArray()).map(cover => cover.ownerId as string),
      );
      await tx.table("covers").bulkAdd(
        trackIds.filter(id => !owned.has(id)).map(id => ({
          id: crypto.randomUUID(),
          ownerType: "track",
          ownerId: id,
          blob: albumCover.blob,
          mimeType: albumCover.mimeType,
          addedAt: now,
          updatedAt: now,
        })),
      );
      await tx.table("covers").delete(albumCover.id);
    }

    await tx.table("tracks").where("albumId").equals(albumId).modify({ albumId: "", albumTitle: "" });
  }
  await tx.table("albums").bulkDelete(blankAlbumIds);
};

/**
 * v15: every listen recorded so far was a deliberate play — autoplay appends
 * were not distinguishable before this version, so they default to "user".
 */
export const upgradeToV15 = async (tx: UpgradeTransaction): Promise<void> => {
  await tx.table("listenEvents").toCollection().modify((event) => {
    if (event.origin === undefined) event.origin = "user";
  });
};

/**
 * v16: library membership is no longer implied by a like, a playlist or a
 * download (downloads are local tracks now, see TrackEntity.sourceRef). Every
 * remote-branded row with pinned = 1 predates that rule and cannot be told
 * apart from an explicit "Add to library", so all of them demote to shadow
 * rows; likes, counts and playlist membership stay. Albums and artists follow
 * when no pinned track references them any more. The offline copies' files
 * are imported post-open (migrate-offline-copies.ts) — file IO cannot run
 * inside this transaction.
 */
export const upgradeToV16 = async (tx: UpgradeTransaction): Promise<void> => {
  const isRemote = (id: string): boolean => sourceKindOfId(id) !== "local";
  const tracks = tx.table("tracks");
  const albums = tx.table("albums");
  const artists = tx.table("artists");

  const pinned = (await tracks.where("pinned").equals(1).toArray()) as {
    id: string;
    albumId: string;
    artistIds: string[];
  }[];
  const demoted = pinned.filter(track => isRemote(track.id)).map(track => track.id);
  if (demoted.length > 0) {
    await tracks.where("id").anyOf(demoted).modify({ pinned: 0 });
  }

  // References that keep a remote album/artist a library member: only the
  // rows that stay pinned (local ones, and remote-branded ones never exist
  // after the modify above).
  const keptAlbumIds = new Set<string>();
  const keptArtistIds = new Set<string>();
  for (const track of pinned) {
    if (isRemote(track.id)) continue;
    keptAlbumIds.add(track.albumId);
    for (const artistId of track.artistIds) keptArtistIds.add(artistId);
  }
  await albums.where("pinned").equals(1)
    .filter(album => isRemote(album.id) && !keptAlbumIds.has(album.id))
    .modify({ pinned: 0 });
  await artists.where("pinned").equals(1)
    .filter(artist => isRemote(artist.id) && !keptArtistIds.has(artist.id))
    .modify({ pinned: 0 });
};
