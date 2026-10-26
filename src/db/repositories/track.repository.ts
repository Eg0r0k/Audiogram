import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { tableOf, type TableSource } from "@/db/tables";
import type { TrackSortKey } from "@/types/track-sort";
import type { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";
import { TrackScope, type TrackScopeSource } from "./track.scope";

export interface TrackLyricsChanges {
  lyricsPath: string | null;
  lyricsFileName: string | null;
  lyricsOffsetMs?: number;
}

export class TrackRepository extends BaseRepository<TrackEntity, TrackId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "tracks"));
  }

  all(): TrackScope {
    return this.scope({ kind: "all" });
  }

  members(): TrackScope {
    return this.all().members();
  }

  liked(): TrackScope {
    return new TrackScope(this.table, { source: { kind: "all" }, members: false, liked: true });
  }

  inAlbum(albumId: AlbumId): TrackScope {
    return this.scope({ kind: "album", albumId });
  }

  byArtist(artistId: ArtistId): TrackScope {
    return this.scope({ kind: "artist", artistId });
  }

  withTag(tagId: TagId): TrackScope {
    return this.scope({ kind: "tag", tagId });
  }

  withIds(ids: readonly TrackId[]): TrackScope {
    return this.scope({ kind: "ids", ids });
  }

  private scope(source: TrackScopeSource): TrackScope {
    return new TrackScope(this.table, { source, members: false, liked: false });
  }

  findLikedSorted(sortKey: TrackSortKey): Promise<TrackEntity[]> {
    return this.liked().rows({ sort: sortKey });
  }

  findLikedSortedPaginated(
    sortKey: TrackSortKey,
    offset: number,
    limit: number,
  ): Promise<TrackEntity[]> {
    return this.liked().rows({ sort: sortKey, offset, limit });
  }

  findAllSortedPaginated(
    sortKey: TrackSortKey,
    offset: number,
    limit: number,
  ): Promise<TrackEntity[]> {
    return this.members().rows({ sort: sortKey, offset, limit });
  }

  async findByAlbumId(albumId: AlbumId): Promise<TrackEntity[]> {
    const all = await this.inAlbum(albumId).rows();
    return all.sort((a, b) =>
      (a.diskNo ?? 1) - (b.diskNo ?? 1) || (a.trackNo ?? 0) - (b.trackNo ?? 0),
    );
  }

  findByArtistId(artistId: ArtistId): Promise<TrackEntity[]> {
    return this.byArtist(artistId).rows();
  }

  deleteByAlbumId(albumId: AlbumId): Promise<number> {
    return this.inAlbum(albumId).delete();
  }

  deleteByArtistId(artistId: ArtistId): Promise<number> {
    return this.byArtist(artistId).delete();
  }

  /** Library members only — a shadow row under a library album is the streaming twin of a downloaded track. */
  countByAlbumId(albumId: AlbumId): Promise<number> {
    return this.inAlbum(albumId).members().count();
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

  async countByArtistIds(artistIds: ArtistId[]): Promise<Map<ArtistId, number>> {
    return guarded(async () => {
      const counts = new Map<ArtistId, number>();
      for (const id of artistIds) counts.set(id, 0);
      if (artistIds.length === 0) return counts;

      // One transaction, so the counts share a snapshot instead of each
      // opening its own.
      await db.transaction("r", "tracks", async () => {
        const counted = await Promise.all(artistIds.map(id => this.byArtist(id).members().count()));
        artistIds.forEach((id, index) => counts.set(id, counted[index]));
      });
      return counts;
    });
  }

  /** Keys only, shadow rows included: the set a search inside the album is scoped to. */
  findIdsByAlbumId(albumId: AlbumId): Promise<TrackId[]> {
    return this.inAlbum(albumId).ids();
  }

  /** Library members. The artist listing is cut from these. */
  findIdsByArtistId(artistId: ArtistId): Promise<TrackId[]> {
    return this.byArtist(artistId).members().ids();
  }

  sumDurationByAlbumId(albumId: AlbumId): Promise<number> {
    return this.inAlbum(albumId).members().sumDuration();
  }

  sumDurationByArtistId(artistId: ArtistId): Promise<number> {
    return this.byArtist(artistId).sumDuration();
  }

  sumDurationByTrackIds(trackIds: TrackId[]): Promise<number> {
    return this.withIds(trackIds).sumDuration();
  }

  findPaginated(offset: number, limit: number): Promise<TrackEntity[]> {
    return this.members().rows({ sort: "date_added_desc", offset, limit });
  }

  findAllSorted(sortKey: TrackSortKey): Promise<TrackEntity[]> {
    return this.members().rows({ sort: sortKey });
  }

  /** Ids only, in the same order as `findAllSorted` — for whole-library selection. */
  findAllIdsSorted(sortKey: TrackSortKey): Promise<TrackId[]> {
    return this.members().ids(sortKey);
  }

  findSortedByIds(ids: TrackId[], sortKey: TrackSortKey): Promise<TrackEntity[]> {
    return this.withIds(ids).rows({ sort: sortKey });
  }

  countAll(): Promise<number> {
    return this.members().count();
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
  setAlbumTitleByAlbumId(albumId: AlbumId, albumTitle: string): Promise<number> {
    return this.inAlbum(albumId).modify({ albumTitle });
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

  findLiked(): Promise<TrackEntity[]> {
    return this.liked().rows();
  }

  sumDurationByLiked(): Promise<number> {
    return this.liked().sumDuration();
  }

  /** Keys only — the set a search inside the liked list is scoped to. */
  findLikedIds(): Promise<TrackId[]> {
    return this.liked().ids();
  }

  findLikedPaginated(offset: number, limit: number): Promise<TrackEntity[]> {
    return this.liked().rows({ offset, limit });
  }

  countLiked(): Promise<number> {
    return this.liked().count();
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

  findByTagId(tagId: TagId): Promise<TrackEntity[]> {
    return this.withTag(tagId).rows();
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

  async countByStoragePathPrefix(prefix: string): Promise<number> {
    return guarded(() => this.table.where("storagePath").startsWith(prefix).count());
  }

  findAllIds(): Promise<TrackId[]> {
    return this.all().ids();
  }
}

export const trackRepository = new TrackRepository();
