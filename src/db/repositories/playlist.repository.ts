import { db } from "@/db";
import type { PlaylistEntity } from "@/db/entities";
import type { PlaylistId, TrackId } from "@/types/ids";
import type { UpdateSpec } from "dexie";
import { Result, ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";

class PlaylistRepository extends BaseRepository<PlaylistEntity, PlaylistId> {
  constructor() {
    super(db.playlists);
  }

  async update(id: PlaylistId, changes: Partial<PlaylistEntity>): Promise<Result<number, Error>> {
    try {
      const withTimestamp: Partial<PlaylistEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      const count = await this.table.update(id, withTimestamp as UpdateSpec<PlaylistEntity>);
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findByName(name: string): Promise<Result<PlaylistEntity | undefined, Error>> {
    try {
      const playlist = await this.table
        .where("name")
        .equalsIgnoreCase(name)
        .first();
      return ok(playlist);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findRecent(limit = 20): Promise<Result<PlaylistEntity[], Error>> {
    try {
      const playlists = await this.table
        .orderBy("updatedAt")
        .reverse()
        .limit(limit)
        .toArray();
      return ok(playlists);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async addTrack(playlistId: PlaylistId, trackId: TrackId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("id")
        .equals(playlistId)
        .modify((playlist) => {
          if (!playlist.trackIds.includes(trackId)) {
            playlist.trackIds.push(trackId);
            playlist.updatedAt = Date.now();
          }
        });
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async removeTrack(playlistId: PlaylistId, trackId: TrackId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("id")
        .equals(playlistId)
        .modify((playlist) => {
          playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
          playlist.updatedAt = Date.now();
        });
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async reorderTracks(playlistId: PlaylistId, trackIds: TrackId[]): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("id")
        .equals(playlistId)
        .modify((playlist) => {
          playlist.trackIds = trackIds;
          playlist.updatedAt = Date.now();
        });
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findTrackIdsPaginated(
    playlistId: PlaylistId,
    offset: number,
    limit: number,
  ): Promise<Result<{ trackIds: TrackId[]; total: number }, Error>> {
    try {
      const playlist = await this.table.get(playlistId);
      if (!playlist) {
        return err(new Error("Playlist not found"));
      }

      const trackIds = playlist.trackIds.slice(offset, offset + limit);
      return ok({ trackIds, total: playlist.trackIds.length });
    }
    catch (error) {
      return err(error as Error);
    }
  }
}

export const playlistRepository = new PlaylistRepository();
