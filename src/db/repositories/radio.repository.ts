import { db } from "@/db";
import type { RadioStationEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { tableOf, type TableSource } from "@/db/tables";
import type { RadioStationId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";

export class RadioStationRepository extends BaseRepository<RadioStationEntity, RadioStationId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "radioStations"));
  }

  async update(
    id: RadioStationId,
    changes: Partial<RadioStationEntity>,
  ): Promise<number> {
    return guarded(() => {
      const withTimestamp: Partial<RadioStationEntity> = {
        ...changes,
        updatedAt: Date.now(),
      };
      return this.table.update(id, withTimestamp);
    });
  }

  async findAllOrderedByDate(): Promise<RadioStationEntity[]> {
    return guarded(() => this.table
      .orderBy("addedAt")
      .reverse()
      .toArray());
  }

  async findFavorites(): Promise<RadioStationEntity[]> {
    return guarded(() => this.table
      .where("isFavorite")
      .equals(1)
      .toArray());
  }

  async toggleFavorite(id: RadioStationId): Promise<boolean> {
    return guarded(async () => {
      const station = await this.table.get(id);
      if (!station) throw new DbError("NOT_FOUND", `RadioStation not found: ${id}`);

      const next = !station.isFavorite;
      await this.table.update(id, {
        isFavorite: next,
        updatedAt: Date.now(),
      });

      return next;
    });
  }

  async markPlayed(id: RadioStationId): Promise<void> {
    return guarded(async () => {
      await this.table.update(id, {
        lastPlayedAt: Date.now(),
      });
    });
  }

  async findRecentlyPlayed(limit = 10): Promise<RadioStationEntity[]> {
    return guarded(() => this.table
      .orderBy("lastPlayedAt")
      .reverse()
      .filter(s => s.lastPlayedAt !== undefined)
      .limit(limit)
      .toArray());
  }
}

export const radioStationRepository = new RadioStationRepository();
