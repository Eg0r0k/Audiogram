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
}

export const trackRepository = new TrackRepository();
