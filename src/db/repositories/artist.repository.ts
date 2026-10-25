import { db } from "@/db";
import type { ArtistEntity } from "@/db/entities";
import { tableOf, type TableSource } from "@/db/tables";
import type { ArtistId } from "@/types/ids";
import { guarded, TimestampedRepository } from "./base.repository";

export class ArtistRepository extends TimestampedRepository<ArtistEntity, ArtistId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "artists"));
  }

  /** Library members only (pinned = 1). */
  async findPinned(): Promise<ArtistEntity[]> {
    return guarded(() => this.table.where("pinned").equals(1).toArray());
  }

  async findByName(name: string): Promise<ArtistEntity | undefined> {
    return guarded(() => this.table
      .where("name")
      .equalsIgnoreCase(name)
      .first());
  }

  async search(query: string, limit = 20): Promise<ArtistEntity[]> {
    return guarded(() => this.table
      .filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
      .limit(limit)
      .toArray());
  }
}

export const artistRepository = new ArtistRepository();
