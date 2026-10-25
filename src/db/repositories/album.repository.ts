import { db } from "@/db";
import type { AlbumEntity } from "@/db/entities";
import { tableOf, type TableSource } from "@/db/tables";
import type { AlbumId, ArtistId } from "@/types/ids";
import { guarded, TimestampedRepository } from "./base.repository";

export class AlbumRepository extends TimestampedRepository<AlbumEntity, AlbumId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "albums"));
  }

  /** Library members only (pinned = 1). */
  async findPinned(): Promise<AlbumEntity[]> {
    return guarded(() => this.table.where("pinned").equals(1).toArray());
  }

  async findByArtistId(artistId: ArtistId): Promise<AlbumEntity[]> {
    return guarded(async () => {
      const albums = await this.table
        .where("artistId")
        .equals(artistId)
        .sortBy("year");
      return [...albums].reverse();
    });
  }

  async findAllSortedByTitle(desc = false): Promise<AlbumEntity[]> {
    return guarded(() => {
      const collection = desc
        ? this.table.orderBy("title").reverse()
        : this.table.orderBy("title");
      return collection.toArray();
    });
  }

  async search(query: string, limit = 20): Promise<AlbumEntity[]> {
    return guarded(() => {
      const normalizedQuery = query.toLowerCase();
      return this.table
        .filter(album => album.title.toLowerCase().includes(normalizedQuery))
        .limit(limit)
        .toArray();
    });
  }

  // Artist-page listing: shadow albums can reference a local artist via
  // substitution — skip them.
  async countByArtistId(artistId: ArtistId): Promise<number> {
    return guarded(() => this.table
      .where("[artistId+pinned]")
      .equals([artistId, 1])
      .count());
  }

  async findByArtistIdPaginated(
    artistId: ArtistId,
    offset: number,
    limit: number,
  ): Promise<AlbumEntity[]> {
    return guarded(async () => {
      // `year` is optional, so a compound [artistId+year] index would miss
      // undated albums; sort in memory instead (an artist has few albums).
      const all = await this.table
        .where("[artistId+pinned]")
        .equals([artistId, 1])
        .sortBy("year");
      all.reverse();
      return all.slice(offset, offset + limit);
    });
  }
}

export const albumRepository = new AlbumRepository();
