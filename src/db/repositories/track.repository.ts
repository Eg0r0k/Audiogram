import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { isDescendingSort, trackSortField, type TrackSortKey } from "@/types/track-sort";
import type { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import Dexie, { type Collection } from "dexie";
import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";
import { toDbError } from "@/db/errors/db.errors";

// Dexie's own floor and ceiling of the IndexedDB key space. They span numbers
// and strings alike, so a sort field needs no per-type bounds and no table
// saying which type it holds: a field left out of such a table would silently
// page through an empty range instead of failing.
const FIELD_FLOOR: unknown = Dexie.minKey;
const FIELD_CEILING: unknown = Dexie.maxKey;

class TrackRepository extends BaseRepository<TrackEntity, TrackId> {
  constructor() {
    super(db.tracks);
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

  async findLikedSorted(sortKey: TrackSortKey): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.getSortedLikedCollection(sortKey).toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findLikedSortedPaginated(
    sortKey: TrackSortKey,
    offset: number,
    limit: number,
  ): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.getSortedLikedCollection(sortKey)
        .offset(offset)
        .limit(limit)
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findAllSortedPaginated(
    sortKey: TrackSortKey,
    offset: number,
    limit: number,
  ): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.getSortedCollection(sortKey)
        .offset(offset)
        .limit(limit)
        .toArray();

      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findByAlbumId(albumId: AlbumId): Promise<Result<TrackEntity[], Error>> {
    try {
      const all = await this.table
        .where("albumId")
        .equals(albumId)
        .toArray();
      all.sort((a, b) =>
        (a.diskNo ?? 1) - (b.diskNo ?? 1) || (a.trackNo ?? 0) - (b.trackNo ?? 0),
      );
      return ok(all);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findByArtistId(artistId: ArtistId): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("artistIds")
        .equals(artistId)
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async deleteByAlbumId(albumId: AlbumId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("albumId")
        .equals(albumId)
        .delete();
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async deleteByArtistId(artistId: ArtistId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("artistIds")
        .equals(artistId)
        .delete();
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Library members only — a shadow row under a library album is the streaming twin of a downloaded track. */
  async countByAlbumId(albumId: AlbumId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("[albumId+pinned]")
        .equals([albumId, 1])
        .count();
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async countByAlbumIds(albumIds: AlbumId[]): Promise<Result<Map<AlbumId, number>, Error>> {
    try {
      const counts = new Map<AlbumId, number>();
      for (const albumId of albumIds) counts.set(albumId, 0);
      if (albumIds.length === 0) return ok(counts);

      // One transaction, so the counts share a snapshot instead of each
      // opening its own.
      await db.transaction("r", this.table, async () => {
        const counted = await Promise.all(
          albumIds.map(id => this.table.where("[albumId+pinned]").equals([id, 1]).count()),
        );
        albumIds.forEach((id, index) => counts.set(id, counted[index]));
      });
      return ok(counts);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /**
   * Each artist's own index entries minus the shadow set, intersected as
   * keys: neither side deserializes a row.
   */
  async countByArtistIds(artistIds: ArtistId[]): Promise<Result<Map<ArtistId, number>, Error>> {
    try {
      const counts = new Map<ArtistId, number>();
      for (const id of artistIds) counts.set(id, 0);
      if (artistIds.length === 0) return ok(counts);

      await db.transaction("r", this.table, async () => {
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
      return ok(counts);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Keys only — the set a search inside the album is scoped to. Same rows `countByAlbumId` counts. */
  async findIdsByAlbumId(albumId: AlbumId): Promise<Result<TrackId[], Error>> {
    try {
      const ids = await this.table.where("albumId").equals(albumId).primaryKeys();
      return ok(ids);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Keys only; library members. The artist listing is cut from these. */
  async findIdsByArtistId(artistId: ArtistId): Promise<Result<TrackId[], Error>> {
    try {
      return ok(await this.memberIdsByArtistId(artistId));
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /**
   * The artist's member track ids, in index order. Both reads are key-only,
   * so nothing is deserialized to answer "which of these are members".
   */
  private async memberIdsByArtistId(artistId: ArtistId): Promise<TrackId[]> {
    return db.transaction("r", this.table, async () => {
      const [ids, shadowIds] = await Promise.all([
        this.table.where("artistIds").equals(artistId).primaryKeys(),
        this.shadowTrackIds(),
      ]);
      if (shadowIds.length === 0) return ids;
      const shadows = new Set<TrackId>(shadowIds);
      return ids.filter(id => !shadows.has(id));
    });
  }

  async sumDurationByAlbumId(albumId: AlbumId): Promise<Result<number, Error>> {
    try {
      let total = 0;
      await this.table
        .where("[albumId+pinned]")
        .equals([albumId, 1])
        .each((track) => { total += track.duration; });
      return ok(total);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async sumDurationByArtistId(artistId: ArtistId): Promise<Result<number, Error>> {
    try {
      let total = 0;
      await this.table
        .where("artistIds")
        .equals(artistId)
        .each((track) => { total += track.duration; });
      return ok(total);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async sumDurationByTrackIds(trackIds: TrackId[]): Promise<Result<number, Error>> {
    try {
      if (trackIds.length === 0) {
        return ok(0);
      }
      let total = 0;
      await this.table
        .where("id")
        .anyOf(trackIds)
        .each((track) => { total += track.duration; });
      return ok(total);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findPaginated(offset: number, limit: number): Promise<Result<TrackEntity[], Error>> {
    return this.findAllSortedPaginated("date_added_desc", offset, limit);
  }

  async findAllSorted(sortKey: TrackSortKey): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.getSortedCollection(sortKey).toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Ids only, in the same order as `findAllSorted` — for whole-library selection. */
  async findAllIdsSorted(sortKey: TrackSortKey): Promise<Result<TrackId[], Error>> {
    try {
      const ids = await this.getSortedCollection(sortKey).primaryKeys();
      return ok(ids);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findSortedByIds(ids: TrackId[], sortKey: TrackSortKey): Promise<Result<TrackEntity[], Error>> {
    try {
      if (ids.length === 0) {
        return ok([]);
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

      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async countAll(): Promise<Result<number, Error>> {
    try {
      const count = await this.table.where("pinned").equals(1).count();
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async sumDurationAll(): Promise<Result<number, Error>> {
    try {
      let total = 0;
      await this.table.where("pinned").equals(1).each((track) => {
        total += track.duration;
      });
      return ok(total);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async setLiked(id: TrackId, isLiked: boolean): Promise<Result<void, Error>> {
    try {
      await this.table.update(id, {
        likedAt: isLiked ? Date.now() : undefined,
      });

      return ok(undefined);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Likes every listed track that is not liked yet, in one operation; returns how many changed. */
  async likeMany(ids: TrackId[], likedAt: number): Promise<Result<number, Error>> {
    try {
      if (ids.length === 0) return ok(0);
      const count = await this.table
        .where("id")
        .anyOf(ids)
        .and(track => !track.likedAt)
        .modify({ likedAt });
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Clears the like on every listed track that is liked, in one operation; returns how many changed. */
  async unlikeMany(ids: TrackId[]): Promise<Result<number, Error>> {
    try {
      if (ids.length === 0) return ok(0);
      const count = await this.table
        .where("id")
        .anyOf(ids)
        .and(track => !!track.likedAt)
        .modify({ likedAt: undefined });
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Rewrites the denormalized album title on every track of the album. */
  async setAlbumTitleByAlbumId(albumId: AlbumId, albumTitle: string): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("albumId")
        .equals(albumId)
        .modify({ albumTitle });
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async setLyricsPath(id: TrackId, lyricsPath: string): Promise<Result<void, Error>> {
    try {
      await this.table.update(id, {
        lyricsPath,
      });

      return ok(undefined);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async toggleLiked(id: TrackId, isLiked: boolean): Promise<Result<number | undefined, Error>> {
    try {
      const nextLikedAt = isLiked ? undefined : Date.now();

      await this.table.update(id, {
        likedAt: nextLikedAt,
      });

      return ok(nextLikedAt);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findLiked(): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("likedAt").above(0)
        .reverse()
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async sumDurationByLiked(): Promise<Result<number, Error>> {
    try {
      let total = 0;
      await this.table
        .where("likedAt")
        .above(0)
        .each((track) => { total += track.duration; });
      return ok(total);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** Keys only — the set a search inside the liked list is scoped to. */
  async findLikedIds(): Promise<Result<TrackId[], Error>> {
    try {
      const ids = await this.table.where("likedAt").above(0).primaryKeys();
      return ok(ids);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findLikedPaginated(offset: number, limit: number): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("likedAt")
        .above(0)
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async countLiked(): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("likedAt")
        .above(0)
        .count();
      return ok(count);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async addTagToTrack(trackId: TrackId, tagId: TagId): Promise<Result<void, Error>> {
    try {
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
        return err(new Error(`Track not found: ${trackId}`));
      }
      return ok(undefined);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async removeTagFromTrack(trackId: TrackId, tagId: TagId): Promise<Result<void, Error>> {
    try {
      const modified = await this.table
        .where("id")
        .equals(trackId)
        .modify((track) => {
          track.tagIds = track.tagIds.filter(id => id !== tagId);
        });
      if (modified === 0) {
        return err(new Error(`Track not found: ${trackId}`));
      }
      return ok(undefined);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findByTagId(tagId: TagId): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("tagIds")
        .equals(tagId)
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findByStoragePath(path: string): Promise<Result<TrackEntity | undefined, Error>> {
    try {
      const track = await this.table.where("storagePath").equals(path).first();
      return ok(track);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  /** The local row downloaded from `remoteId`, if any (see TrackEntity.sourceRef). */
  async findBySourceRef(remoteId: TrackId): Promise<Result<TrackEntity | undefined, Error>> {
    try {
      const track = await this.table.where("sourceRef").equals(remoteId).first();
      return ok(track);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async existsByFingerprint(fingerprint: string): Promise<Result<boolean, Error>> {
    try {
      const count = await this.table.where("fingerprint").equals(fingerprint).count();
      return ok(count > 0);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async getAllFingerprints(): Promise<Result<Set<string>, Error>> {
    try {
      const keys = await this.table.where("fingerprint").above("").uniqueKeys();
      return ok(new Set(keys as string[]));
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findByStoragePathPrefix(prefix: string): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table.where("storagePath").startsWith(prefix).toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }

  async findAllIds(): Promise<Result<TrackId[], Error>> {
    try {
      const ids = await this.table.toCollection().primaryKeys();
      return ok(ids);
    }
    catch (error) {
      return err(toDbError(error));
    }
  }
}

export const trackRepository = new TrackRepository();
