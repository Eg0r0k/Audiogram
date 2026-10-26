import type { UpdateSpec } from "dexie";
import { db } from "@/db";
import { tallying, touchesCounters } from "@/db/counters";
import type { TrackEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { tableOf, type TableSource } from "@/db/tables";
import { unique } from "@/lib/math";
import type { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";
import { CounterRepository } from "./counter.repository";
import { TrackScope, type TrackScopeSource } from "./track.scope";

export interface TrackLyricsChanges {
  lyricsPath: string | null;
  lyricsFileName: string | null;
  lyricsOffsetMs?: number;
}

const likeWith = (likedAt: number | undefined) => (track: TrackEntity): boolean => {
  if (track.likedAt === likedAt) return false;
  if (likedAt === undefined) delete track.likedAt;
  else track.likedAt = likedAt;
  return true;
};

export class TrackRepository extends BaseRepository<TrackEntity, TrackId> {
  private readonly counters: CounterRepository;

  constructor(source: TableSource = db) {
    super(tableOf(source, "tracks"));
    this.counters = new CounterRepository(source);
  }

  all(): TrackScope {
    return this.scope({ kind: "all" });
  }

  members(): TrackScope {
    return this.all().members();
  }

  liked(): TrackScope {
    return new TrackScope(this.table, { source: { kind: "all" }, members: false, liked: true }, this.counters);
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
    return new TrackScope(this.table, { source, members: false, liked: false }, this.counters);
  }

  override create(entity: TrackEntity): Promise<TrackId> {
    return this.counters.counting(async (tally) => {
      const id = await this.table.add(entity);
      tally(undefined, entity);
      return id;
    });
  }

  override createMany(entities: TrackEntity[]): Promise<TrackId[]> {
    return this.counters.counting(async (tally) => {
      const ids = await this.table.bulkAdd(entities, { allKeys: true });
      for (const entity of entities) tally(undefined, entity);
      return ids;
    });
  }

  override upsert(entity: TrackEntity): Promise<TrackId> {
    return this.counters.counting(async (tally) => {
      const before = await this.table.get(entity.id);
      const id = await this.table.put(entity);
      tally(before, entity);
      return id;
    });
  }

  override upsertMany(entities: TrackEntity[]): Promise<TrackId[]> {
    return this.counters.counting(async (tally) => {
      const written = new Map(entities.map(entity => [entity.id, entity]));
      const before = await this.table.bulkGet([...written.keys()]);
      const ids = await this.table.bulkPut(entities, { allKeys: true });
      [...written.values()].forEach((entity, index) => tally(before[index], entity));
      return ids;
    });
  }

  override update(id: TrackId, changes: Partial<TrackEntity>): Promise<number> {
    if (!touchesCounters(changes)) return super.update(id, changes);
    return this.counters.countingByIds(() => [id], () => this.table.update(id, changes as UpdateSpec<TrackEntity>));
  }

  override updateMany(updates: { key: TrackId; changes: UpdateSpec<TrackEntity> }[]): Promise<number> {
    if (!updates.some(({ changes }) => touchesCounters(changes))) return super.updateMany(updates);
    return this.counters.countingByIds(() => updates.map(({ key }) => key), () => this.table.bulkUpdate(updates));
  }

  override delete(id: TrackId): Promise<void> {
    return this.counters.counting(async (tally) => {
      const before = await this.table.get(id);
      await this.table.delete(id);
      tally(before, undefined);
    });
  }

  override deleteMany(ids: TrackId[]): Promise<void> {
    return this.counters.counting(async (tally) => {
      const keys = unique(ids);
      const before = await this.table.bulkGet(keys);
      await this.table.bulkDelete(keys);
      for (const row of before) tally(row, undefined);
    });
  }

  async setLiked(id: TrackId, isLiked: boolean): Promise<void> {
    await this.setLikedAt(id, isLiked ? Date.now() : undefined);
  }

  /** Likes every listed track that is not liked yet, in one operation; returns how many changed. */
  async likeMany(ids: TrackId[], likedAt: number): Promise<number> {
    if (ids.length === 0) return 0;
    return this.counters.counting(tally => this.table
      .where("id")
      .anyOf(ids)
      .and(track => !track.likedAt)
      .modify(tallying(tally, likeWith(likedAt))));
  }

  /** Clears the like on every listed track that is liked, in one operation; returns how many changed. */
  async unlikeMany(ids: TrackId[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.counters.counting(tally => this.table
      .where("id")
      .anyOf(ids)
      .and(track => !!track.likedAt)
      .modify(tallying(tally, likeWith(undefined))));
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
    const nextLikedAt = isLiked ? undefined : Date.now();
    await this.setLikedAt(id, nextLikedAt);
    return nextLikedAt;
  }

  private setLikedAt(id: TrackId, likedAt: number | undefined): Promise<number> {
    return this.counters.counting(tally => this.table.where("id").equals(id).modify(tallying(tally, likeWith(likedAt))));
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
