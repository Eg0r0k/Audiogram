import { db } from "@/db";
import type { PlaylistEntity } from "@/db/entities";
import { tableOf, type TableSource } from "@/db/tables";
import type { PlaylistId, TrackId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";
import { DbError } from "@/db/errors/db.errors";

export class PlaylistRepository extends BaseRepository<PlaylistEntity, PlaylistId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "playlists"));
  }

  async update(id: PlaylistId, changes: Partial<PlaylistEntity>): Promise<number> {
    return guarded(() => {
      const withTimestamp: Partial<PlaylistEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      return this.table.update(id, withTimestamp);
    });
  }

  async findByName(name: string): Promise<PlaylistEntity | undefined> {
    return guarded(() => this.table
      .where("name")
      .equalsIgnoreCase(name)
      .first());
  }

  async findRecent(limit = 20): Promise<PlaylistEntity[]> {
    return guarded(() => this.table
      .orderBy("updatedAt")
      .reverse()
      .limit(limit)
      .toArray());
  }

  async addTrack(playlistId: PlaylistId, trackId: TrackId): Promise<number> {
    return guarded(() => this.table
      .where("id")
      .equals(playlistId)
      .modify((playlist) => {
        if (!playlist.trackIds.includes(trackId)) {
          playlist.trackIds.push(trackId);
          playlist.updatedAt = Date.now();
        }
      }));
  }

  /** Appends the ids not yet in the playlist with one row write; returns the appended ids in order. */
  async addTracks(playlistId: PlaylistId, trackIds: TrackId[]): Promise<TrackId[]> {
    return guarded(async () => {
      let added: TrackId[] = [];
      await this.table
        .where("id")
        .equals(playlistId)
        .modify((playlist) => {
          const seen = new Set(playlist.trackIds);
          added = trackIds.filter((id) => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          if (added.length === 0) return;
          playlist.trackIds = [...playlist.trackIds, ...added];
          playlist.updatedAt = Date.now();
        });
      return added;
    });
  }

  async removeTrack(playlistId: PlaylistId, trackId: TrackId): Promise<number> {
    return guarded(() => this.table
      .where("id")
      .equals(playlistId)
      .modify((playlist) => {
        playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
        playlist.updatedAt = Date.now();
      }));
  }

  /** Puts the track at `index` (clamped to the end) unless the playlist already has it. */
  insertTrack = async (playlistId: PlaylistId, trackId: TrackId, index: number): Promise<number> =>
    guarded(() => this.table
      .where("id")
      .equals(playlistId)
      .modify((playlist) => {
        if (playlist.trackIds.includes(trackId)) return;
        playlist.trackIds.splice(Math.min(index, playlist.trackIds.length), 0, trackId);
        playlist.updatedAt = Date.now();
      }));

  async reorderTracks(playlistId: PlaylistId, trackIds: TrackId[]): Promise<number> {
    return guarded(() => this.table
      .where("id")
      .equals(playlistId)
      .modify((playlist) => {
        playlist.trackIds = trackIds;
        playlist.updatedAt = Date.now();
      }));
  }

  async findTrackIdsPaginated(
    playlistId: PlaylistId,
    offset: number,
    limit: number,
  ): Promise<{ trackIds: TrackId[]; total: number }> {
    return guarded(async () => {
      const playlist = await this.table.get(playlistId);
      if (!playlist) {
        throw new DbError("NOT_FOUND", "Playlist not found");
      }

      const trackIds = playlist.trackIds.slice(offset, offset + limit);
      return { trackIds, total: playlist.trackIds.length };
    });
  }
}

export const playlistRepository = new PlaylistRepository();
