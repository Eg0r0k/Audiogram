import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { tableOf, type TableSource } from "@/db/tables";
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
}

export const trackRepository = new TrackRepository();
