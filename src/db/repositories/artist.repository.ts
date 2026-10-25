import { db } from "@/db";
import type { ArtistEntity } from "@/db/entities";
import type { ArtistId } from "@/types/ids";
import type { Result } from "neverthrow";
import { BaseRepository } from "./base.repository";
import { attemptDb } from "@/db/errors/db.errors";

class ArtistRepository extends BaseRepository<ArtistEntity, ArtistId> {
  constructor() {
    super(db.artists);
  }

  async update(id: ArtistId, changes: Partial<ArtistEntity>): Promise<Result<number, Error>> {
    return attemptDb(() => {
      const withTimestamp: Partial<ArtistEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      return this.table.update(id, withTimestamp);
    });
  }

  /** Library members only (pinned = 1). */
  async findPinned(): Promise<Result<ArtistEntity[], Error>> {
    return attemptDb(() => this.table.where("pinned").equals(1).toArray());
  }

  async findByName(name: string): Promise<Result<ArtistEntity | undefined, Error>> {
    return attemptDb(() => this.table
      .where("name")
      .equalsIgnoreCase(name)
      .first());
  }

  async search(query: string, limit = 20): Promise<Result<ArtistEntity[], Error>> {
    return attemptDb(() => this.table
      .filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
      .limit(limit)
      .toArray());
  }
}

export const artistRepository = new ArtistRepository();
