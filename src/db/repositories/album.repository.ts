import { db } from "@/db";
import type { AlbumEntity } from "@/db/entities";
import type { AlbumId, ArtistId } from "@/types/ids";
import { Result, ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";

class AlbumRepository extends BaseRepository<AlbumEntity, AlbumId> {
  constructor() {
    super(db.albums);
  }

  async findByArtistId(artistId: ArtistId): Promise<Result<AlbumEntity[], Error>> {
    try {
      const albums = await this.table
        .where("artistId")
        .equals(artistId)
        .sortBy("year");
      return ok(albums.reverse());
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

export const albumRepository = new AlbumRepository();
