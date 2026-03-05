import { db } from "@/db";
import type { ArtistEntity } from "@/db/entities";
import type { ArtistId } from "@/types/ids";
import { Result, ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";

class ArtistRepository extends BaseRepository<ArtistEntity, ArtistId> {
  constructor() {
    super(db.artists);
  }

  async findByName(name: string): Promise<Result<ArtistEntity | undefined, Error>> {
    try {
      const artist = await this.table
        .where("name")
        .equalsIgnoreCase(name)
        .first();
      return ok(artist);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async search(query: string, limit = 20): Promise<Result<ArtistEntity[], Error>> {
    try {
      const artists = await this.table
        .filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
        .limit(limit)
        .toArray();
      return ok(artists);
    }
    catch (error) {
      return err(error as Error);
    }
  }
}

export const artistRepository = new ArtistRepository();
