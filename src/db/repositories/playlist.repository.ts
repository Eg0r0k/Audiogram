import { db } from "@/db";
import type { PlaylistEntity } from "@/db/entities";
import type { PlaylistId, TrackId } from "@/types/ids";
import type { Result } from "neverthrow";
import { ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";
import { DbError, attemptDb } from "@/db/errors/db.errors";

class PlaylistRepository extends BaseRepository<PlaylistEntity, PlaylistId> {
  constructor() {
    super(db.playlists);
  }

  async update(id: PlaylistId, changes: Partial<PlaylistEntity>): Promise<Result<number, Error>> {
    return attemptDb(() => {
      const withTimestamp: Partial<PlaylistEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      return this.table.update(id, withTimestamp);
    });
  }

  async findByName(name: string): Promise<Result<PlaylistEntity | undefined, Error>> {
    return attemptDb(() => this.table
      .where("name")
      .equalsIgnoreCase(name)
      .first());
  }

  async findRecent(limit = 20): Promise<Result<PlaylistEntity[], Error>> {
    return attemptDb(() => this.table
      .orderBy("updatedAt")
      .reverse()
      .limit(limit)
      .toArray());
  }

  async addTrack(playlistId: PlaylistId, trackId: TrackId): Promise<Result<number, Error>> {
    return attemptDb(() => this.table
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
  async addTracks(playlistId: PlaylistId, trackIds: TrackId[]): Promise<Result<TrackId[], Error>> {
    return attemptDb(async () => {
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

  async removeTrack(playlistId: PlaylistId, trackId: TrackId): Promise<Result<number, Error>> {
    return attemptDb(() => this.table
      .where("id")
      .equals(playlistId)
      .modify((playlist) => {
        playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
        playlist.updatedAt = Date.now();
      }));
  }

  /** Puts the track at `index` (clamped to the end) unless the playlist already has it. */
  insertTrack = async (playlistId: PlaylistId, trackId: TrackId, index: number): Promise<Result<number, Error>> => {
    return attemptDb(() => this.table
      .where("id")
      .equals(playlistId)
      .modify((playlist) => {
        if (playlist.trackIds.includes(trackId)) return;
        playlist.trackIds.splice(Math.min(index, playlist.trackIds.length), 0, trackId);
        playlist.updatedAt = Date.now();
      }));
  };

  async reorderTracks(playlistId: PlaylistId, trackIds: TrackId[]): Promise<Result<number, Error>> {
    return attemptDb(() => this.table
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
  ): Promise<Result<{ trackIds: TrackId[]; total: number }, Error>> {
    const page = await attemptDb(async () => {
      const playlist = await this.table.get(playlistId);
      return playlist && { trackIds: playlist.trackIds.slice(offset, offset + limit), total: playlist.trackIds.length };
    });
    return page.andThen(found => found
      ? ok(found)
      : err(new DbError("NOT_FOUND", "Playlist not found")));
  }
}

export const playlistRepository = new PlaylistRepository();
