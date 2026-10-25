import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { tableOf, type TableSource } from "@/db/tables";
import { isDescendingSort, trackSortField, type TrackSortKey } from "@/types/track-sort";
import type { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import Dexie, { type Collection } from "dexie";
import { BaseRepository, guarded } from "./base.repository";

// Dexie's own floor and ceiling of the IndexedDB key space. They span numbers
// and strings alike, so a sort field needs no per-type bounds and no table
// saying which type it holds: a field left out of such a table would silently
// page through an empty range instead of failing.
const FIELD_FLOOR: unknown = Dexie.minKey;
const FIELD_CEILING: unknown = Dexie.maxKey;

export interface TrackLyricsChanges {
  lyricsPath: string | null;
  lyricsFileName: string | null;
  lyricsOffsetMs?: number;
}

export class TrackRepository extends BaseRepository<TrackEntity, TrackId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "tracks"));
  }

  /**
   * Listings and counts skip shadow rows (pinned = 0); point lookups and
   * deletion cascades stay unscoped on purpose.
   *
   * Membership rides an index wherever one can express it
   * (`[pinned+<sortField>]`, `[albumId+pinned]`). The multi-entry `artistIds`
   * index cannot carry `pinned` alongside it, so those reads subtract this
   * set instead. The two are not the same predicate: the ranges select
   * `pinned === 1`, this selects "not 0". They agree only because
   * `pinned` is required on TrackEntity; migrations.integration.test.ts is
   * what holds that, since nothing downstream could detect the loss.
   */
  private shadowTrackIds(): Promise<TrackId[]> {
    return this.table.where("pinned").equals(0).primaryKeys();
  }

  private getSortedCollection(sortKey: TrackSortKey): Collection<TrackEntity, TrackId> {
    const field = trackSortField(sortKey);
    const collection = this.table
      .where(`[pinned+${field}]`)
      .between([1, FIELD_FLOOR], [1, FIELD_CEILING], true, true);
    return isDescendingSort(sortKey) ? collection.reverse() : collection;
  }

  private getSortedLikedCollection(sortKey: TrackSortKey): Collection<TrackEntity, TrackId> {
    const field = trackSortField(sortKey);
    // The sort field spans the whole key space; `likedAt` is what narrows the
    // range, and an unliked row carries none at all, so it is not in this
    // index to begin with.
    const collection = this.table.where(`[${field}+likedAt]`).between(
      [FIELD_FLOOR, 1],
      [FIELD_CEILING, Infinity],
    );
    return isDescendingSort(sortKey) ? collection.reverse() : collection;
  }

  async findLikedSorted(sortKey: TrackSortKey): Promise<TrackEntity[]> {
    return guarded(() => this.getSortedLikedCollection(sortKey).toArray());
  }

  async findLikedSortedPaginated(
    sortKey: TrackSortKey,
    offset: number,
    limit: number,
  ): Promise<TrackEntity[]> {
    return guarded(() => this.getSortedLikedCollection(sortKey)
      .offset(offset)
      .limit(limit)
      .toArray());
  }

  async findAllSortedPaginated(
    sortKey: TrackSortKey,
    offset: number,
    limit: number,
  ): Promise<TrackEntity[]> {
    return guarded(() => this.getSortedCollection(sortKey)
      .offset(offset)
      .limit(limit)
      .toArray());
  }

  async findByAlbumId(albumId: AlbumId): Promise<TrackEntity[]> {
    return guarded(async () => {
      const all = await this.table
        .where("albumId")
        .equals(albumId)
        .toArray();
      all.sort((a, b) =>
        (a.diskNo ?? 1) - (b.diskNo ?? 1) || (a.trackNo ?? 0) - (b.trackNo ?? 0),
      );
      return all;
    });
  }

  async findByArtistId(artistId: ArtistId): Promise<TrackEntity[]> {
    return guarded(() => this.table
      .where("artistIds")
      .equals(artistId)
      .toArray());
  }

  async deleteByAlbumId(albumId: AlbumId): Promise<number> {
    return guarded(() => this.table
      .where("albumId")
      .equals(albumId)
      .delete());
  }

  async deleteByArtistId(artistId: ArtistId): Promise<number> {
    return guarded(() => this.table
      .where("artistIds")
      .equals(artistId)
      .delete());
  }

  /** Library members only — a shadow row under a library album is the streaming twin of a downloaded track. */
  async countByAlbumId(albumId: AlbumId): Promise<number> {
    return guarded(() => this.table
      .where("[albumId+pinned]")
      .equals([albumId, 1])
      .count());
  }

  async countByAlbumIds(albumIds: AlbumId[]): Promise<Map<AlbumId, number>> {
    return guarded(async () => {
      const counts = new Map<AlbumId, number>();
      for (const albumId of albumIds) counts.set(albumId, 0);
      if (albumIds.length === 0) return counts;

      // One transaction, so the counts share a snapshot instead of each
      // opening its own.
      await db.transaction("r", "tracks", async () => {
        const counted = await Promise.all(
          albumIds.map(id => this.table.where("[albumId+pinned]").equals([id, 1]).count()),
        );
        albumIds.forEach((id, index) => counts.set(id, counted[index]));
      });
      return counts;
    });
  }

  /**
   * Each artist's own index entries minus the shadow set, intersected as
   * keys: neither side deserializes a row.
   */
  async countByArtistIds(artistIds: ArtistId[]): Promise<Map<ArtistId, number>> {
    return guarded(async () => {
      const counts = new Map<ArtistId, number>();
      for (const id of artistIds) counts.set(id, 0);
      if (artistIds.length === 0) return counts;

      await db.transaction("r", "tracks", async () => {
        const [shadowIds, perArtist] = await Promise.all([
          this.shadowTrackIds(),
          Promise.all(artistIds.map(id => this.table.where("artistIds").equals(id).primaryKeys())),
        ]);
        const shadows = new Set<TrackId>(shadowIds);

        artistIds.forEach((id, index) => {
          let members = 0;
          for (const trackId of new Set(perArtist[index])) {
            if (!shadows.has(trackId)) members++;
          }
          counts.set(id, members);
        });
      });
      return counts;
    });
  }

  /** Keys only — the set a search inside the album is scoped to. Same rows `countByAlbumId` counts. */
  async findIdsByAlbumId(albumId: AlbumId): Promise<TrackId[]> {
    return guarded(() => this.table.where("albumId").equals(albumId).primaryKeys());
  }

  /** Keys only; library members. The artist listing is cut from these. */
  async findIdsByArtistId(artistId: ArtistId): Promise<TrackId[]> {
    return guarded(() => this.memberIdsByArtistId(artistId));
  }

  /**
   * The artist's member track ids, in index order. Both reads are key-only,
   * so nothing is deserialized to answer "which of these are members".
   */
  private async memberIdsByArtistId(artistId: ArtistId): Promise<TrackId[]> {
    return db.transaction("r", "tracks", async () => {
      const [ids, shadowIds] = await Promise.all([
        this.table.where("artistIds").equals(artistId).primaryKeys(),
        this.shadowTrackIds(),
      ]);
      if (shadowIds.length === 0) return ids;
      const shadows = new Set<TrackId>(shadowIds);
      return ids.filter(id => !shadows.has(id));
    });
  }

  async sumDurationByAlbumId(albumId: AlbumId): Promise<number> {
    return guarded(async () => {
      let total = 0;
      await this.table
        .where("[albumId+pinned]")
        .equals([albumId, 1])
        .each((track) => { total += track.duration; });
      return total;
    });
  }

  async sumDurationByArtistId(artistId: ArtistId): Promise<number> {
    return guarded(async () => {
      let total = 0;
      await this.table
        .where("artistIds")
        .equals(artistId)
        .each((track) => { total += track.duration; });
      return total;
    });
  }

  async sumDurationByTrackIds(trackIds: TrackId[]): Promise<number> {
    return guarded(async () => {
      if (trackIds.length === 0) {
        return 0;
      }
      let total = 0;
      await this.table
        .where("id")
        .anyOf(trackIds)
        .each((track) => { total += track.duration; });
      return total;
    });
  }

  async findPaginated(offset: number, limit: number): Promise<TrackEntity[]> {
    return this.findAllSortedPaginated("date_added_desc", offset, limit);
  }

  async findAllSorted(sortKey: TrackSortKey): Promise<TrackEntity[]> {
    return guarded(() => this.getSortedCollection(sortKey).toArray());
  }

  /** Ids only, in the same order as `findAllSorted` — for whole-library selection. */
  async findAllIdsSorted(sortKey: TrackSortKey): Promise<TrackId[]> {
    return guarded(() => this.getSortedCollection(sortKey).primaryKeys());
  }

  async findSortedByIds(ids: TrackId[], sortKey: TrackSortKey): Promise<TrackEntity[]> {
    return guarded(async () => {
      if (ids.length === 0) {
        return [];
      }

      const field = trackSortField(sortKey);
      const isDesc = isDescendingSort(sortKey);

      const tracks = await this.table
        .where("id")
        .anyOf(ids)
        .sortBy(field);

      if (isDesc) {
        tracks.reverse();
      }

      return tracks;
    });
  }

  async countAll(): Promise<number> {
    return guarded(() => this.table.where("pinned").equals(1).count());
  }

  async setLiked(id: TrackId, isLiked: boolean): Promise<void> {
    return guarded(async () => {
      await this.table.update(id, {
        likedAt: isLiked ? Date.now() : undefined,
      });
    });
  }

  /** Likes every listed track that is not liked yet, in one operation; returns how many changed. */
  async likeMany(ids: TrackId[], likedAt: number): Promise<number> {
    return guarded(async () => {
      if (ids.length === 0) return 0;
      return this.table
        .where("id")
        .anyOf(ids)
        .and(track => !track.likedAt)
        .modify({ likedAt });
    });
  }

  /** Clears the like on every listed track that is liked, in one operation; returns how many changed. */
  async unlikeMany(ids: TrackId[]): Promise<number> {
    return guarded(async () => {
      if (ids.length === 0) return 0;
      return this.table
        .where("id")
        .anyOf(ids)
        .and(track => !!track.likedAt)
        .modify({ likedAt: undefined });
    });
  }

  /** Rewrites the denormalized album title on every track of the album. */
  async setAlbumTitleByAlbumId(albumId: AlbumId, albumTitle: string): Promise<number> {
    return guarded(() => this.table
      .where("albumId")
      .equals(albumId)
      .modify({ albumTitle }));
  }

  async setLyrics(id: TrackId, lyrics: TrackLyricsChanges): Promise<void> {
    return guarded(async () => {
      // Dexie 4 deletes a key whose new value is undefined.
      await this.table.update(id, {
        lyricsPath: lyrics.lyricsPath ?? undefined,
        lyricsFileName: lyrics.lyricsFileName ?? undefined,
        ...(lyrics.lyricsOffsetMs === undefined ? {} : { lyricsOffsetMs: lyrics.lyricsOffsetMs }),
      });
    });
  }

  async setLyricsOffset(id: TrackId, offsetMs: number): Promise<void> {
    return guarded(async () => {
      await this.table.update(id, { lyricsOffsetMs: offsetMs });
    });
  }

  async toggleLiked(id: TrackId, isLiked: boolean): Promise<number | undefined> {
    return guarded(async () => {
      const nextLikedAt = isLiked ? undefined : Date.now();

      await this.table.update(id, {
        likedAt: nextLikedAt,
      });

      return nextLikedAt;
    });
  }

  async findLiked(): Promise<TrackEntity[]> {
    return guarded(() => this.table
      .where("likedAt").above(0)
      .reverse()
      .toArray());
  }

  async sumDurationByLiked(): Promise<number> {
    return guarded(async () => {
      let total = 0;
      await this.table
        .where("likedAt")
        .above(0)
        .each((track) => { total += track.duration; });
      return total;
    });
  }

  /** Keys only — the set a search inside the liked list is scoped to. */
  async findLikedIds(): Promise<TrackId[]> {
    return guarded(() => this.table.where("likedAt").above(0).primaryKeys());
  }

  async findLikedPaginated(offset: number, limit: number): Promise<TrackEntity[]> {
    return guarded(() => this.table
      .where("likedAt")
      .above(0)
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray());
  }

  async countLiked(): Promise<number> {
    return guarded(() => this.table
      .where("likedAt")
      .above(0)
      .count());
  }

  async addTagToTrack(trackId: TrackId, tagId: TagId): Promise<void> {
    return guarded(async () => {
      // modify() runs read + write in one transaction, so two tag additions
      // racing on the same track cannot overwrite each other.
      const modified = await this.table
        .where("id")
        .equals(trackId)
        .modify((track) => {
          const current = track.tagIds;
          if (!current.includes(tagId)) track.tagIds = [...current, tagId];
        });
      if (modified === 0) {
        throw new DbError("NOT_FOUND", `Track not found: ${trackId}`);
      }
    });
  }

  async removeTagFromTrack(trackId: TrackId, tagId: TagId): Promise<void> {
    return guarded(async () => {
      const modified = await this.table
        .where("id")
        .equals(trackId)
        .modify((track) => {
          track.tagIds = track.tagIds.filter(id => id !== tagId);
        });
      if (modified === 0) {
        throw new DbError("NOT_FOUND", `Track not found: ${trackId}`);
      }
    });
  }

  async findByTagId(tagId: TagId): Promise<TrackEntity[]> {
    return guarded(() => this.table
      .where("tagIds")
      .equals(tagId)
      .toArray());
  }

  async findByStoragePath(path: string): Promise<TrackEntity | undefined> {
    return guarded(() => this.table.where("storagePath").equals(path).first());
  }

  /** The local row downloaded from `remoteId`, if any (see TrackEntity.sourceRef). */
  async findBySourceRef(remoteId: TrackId): Promise<TrackEntity | undefined> {
    return guarded(() => this.table.where("sourceRef").equals(remoteId).first());
  }

  async existsByFingerprint(fingerprint: string): Promise<boolean> {
    return guarded(async () => {
      const count = await this.table.where("fingerprint").equals(fingerprint).count();
      return count > 0;
    });
  }

  /**
   * The candidates the library already holds. One index count per candidate
   * rather than a key cursor over the whole index, so the cost follows the
   * batch being imported, not the library size.
   */
  async findExistingFingerprints(candidates: readonly string[]): Promise<Set<string>> {
    return guarded(async () => {
      const unique = [...new Set(candidates)];
      if (unique.length === 0) return new Set<string>();
      const counts = await db.transaction("r", "tracks", () =>
        Promise.all(unique.map(fingerprint => this.table.where("fingerprint").equals(fingerprint).count())));
      return new Set(unique.filter((_, index) => counts[index] > 0));
    });
  }

  async findByStoragePathPrefix(prefix: string): Promise<TrackEntity[]> {
    return guarded(() => this.table.where("storagePath").startsWith(prefix).toArray());
  }

  async findAllIds(): Promise<TrackId[]> {
    return guarded(() => this.table.toCollection().primaryKeys());
  }
}

export const trackRepository = new TrackRepository();
