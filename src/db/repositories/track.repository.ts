import { db } from "@/db";
import type { TrackEntity } from "@/db/entities";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { Result, ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";

class TrackRepository extends BaseRepository<TrackEntity, TrackId> {
  constructor() {
    super(db.tracks);
  }

  async findByAlbumId(albumId: AlbumId): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("albumId")
        .equals(albumId)
        .sortBy("trackNo");
      return ok(tracks);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findByArtistId(artistId: ArtistId): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("artistId")
        .equals(artistId)
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(error as Error);
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
      return err(error as Error);
    }
  }

  async deleteByArtistId(artistId: ArtistId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("artistId")
        .equals(artistId)
        .delete();
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async countByAlbumId(albumId: AlbumId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("albumId")
        .equals(albumId)
        .count();
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async countByArtistId(artistId: ArtistId): Promise<Result<number, Error>> {
    try {
      const count = await this.table
        .where("artistId")
        .equals(artistId)
        .count();
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async findByIds(ids: TrackId[]): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("id")
        .anyOf(ids)
        .toArray();

      const map = new Map(tracks.map(track => [track.id, track]));
      return ok(ids.flatMap(id => map.get(id) ? [map.get(id)!] : []));
    }
    catch (error) {
      return err(error as Error);
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
      return err(error as Error);
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
      return err(error as Error);
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
      return err(error as Error);
    }
  }

  async findLiked(): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await this.table
        .where("likedAt")
        .above(0)
        .reverse()
        .sortBy("likedAt");
      return ok(tracks);
    }
    catch (error) {
      return err(error as Error);
    }
  }
}

export const trackRepository = new TrackRepository();
