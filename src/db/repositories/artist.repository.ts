import { db } from "@/db";
import type { ArtistEntity, TrackEntity } from "@/db/entities";
import type { ArtistId } from "@/types/ids";
import type { UpdateSpec } from "dexie";
import { Result, ok, err } from "neverthrow";
import { BaseRepository } from "./base.repository";

class ArtistRepository extends BaseRepository<ArtistEntity, ArtistId> {
  constructor() {
    super(db.artists);
  }

  async update(id: ArtistId, changes: Partial<ArtistEntity>): Promise<Result<number, Error>> {
    try {
      const withTimestamp: Partial<ArtistEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      const count = await this.table.update(id, withTimestamp as UpdateSpec<ArtistEntity>);
      return ok(count);
    }
    catch (error) {
      return err(error as Error);
    }
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

  async findTracksPaginated(
    artistId: ArtistId,
    offset: number,
    limit: number,
  ): Promise<Result<TrackEntity[], Error>> {
    try {
      const tracks = await db.tracks
        .where("artistId")
        .equals(artistId)
        .offset(offset)
        .limit(limit)
        .toArray();
      return ok(tracks);
    }
    catch (error) {
      return err(error as Error);
    }
  }

  async countTracksByArtistId(artistId: ArtistId): Promise<Result<number, Error>> {
    try {
      const count = await db.tracks
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

export const artistRepository = new ArtistRepository();
