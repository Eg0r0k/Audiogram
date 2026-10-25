import { db } from "@/db";
import type { AlbumEntity } from "@/db/entities";
import type { AlbumId, ArtistId } from "@/types/ids";
import type { Result } from "neverthrow";
import { BaseRepository } from "./base.repository";
import { attemptDb } from "@/db/errors/db.errors";

class AlbumRepository extends BaseRepository<AlbumEntity, AlbumId> {
  constructor() {
    super(db.albums);
  }

  async update(id: AlbumId, changes: Partial<AlbumEntity>): Promise<Result<number, Error>> {
    return attemptDb(() => {
      const withTimestamp: Partial<AlbumEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      return this.table.update(id, withTimestamp);
    });
  }

  /** Library members only (pinned = 1). */
  async findPinned(): Promise<Result<AlbumEntity[], Error>> {
    return attemptDb(() => this.table.where("pinned").equals(1).toArray());
  }

  async findByArtistId(artistId: ArtistId): Promise<Result<AlbumEntity[], Error>> {
    return attemptDb(async () => {
      const albums = await this.table
        .where("artistId")
        .equals(artistId)
        .sortBy("year");
      return [...albums].reverse();
    });
  }

  async findAllSortedByTitle(desc = false): Promise<Result<AlbumEntity[], Error>> {
    return attemptDb(() => {
      const collection = desc
        ? this.table.orderBy("title").reverse()
        : this.table.orderBy("title");
      return collection.toArray();
    });
  }

  async search(query: string, limit = 20): Promise<Result<AlbumEntity[], Error>> {
    return attemptDb(() => {
      const normalizedQuery = query.toLowerCase();
      return this.table
        .filter(album => album.title.toLowerCase().includes(normalizedQuery))
        .limit(limit)
        .toArray();
    });
  }

  // Artist-page listing: shadow albums can reference a local artist via
  // substitution — skip them.
  async countByArtistId(artistId: ArtistId): Promise<Result<number, Error>> {
    return attemptDb(() => this.table
      .where("[artistId+pinned]")
      .equals([artistId, 1])
      .count());
  }

  async findByArtistIdPaginated(
    artistId: ArtistId,
    offset: number,
    limit: number,
  ): Promise<Result<AlbumEntity[], Error>> {
    return attemptDb(async () => {
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
