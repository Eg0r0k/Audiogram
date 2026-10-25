import { db } from "@/db";
import type { AudioFeaturesEntity } from "@/db/entities";
import { BaseRepository } from "./base.repository";
import type { TrackId } from "@/types/ids";
import type { Result } from "neverthrow";
import { attemptDb } from "@/db/errors/db.errors";

export const CURRENT_ALGORITHM_VERSION = 1;

class AudioFeaturesRepository extends BaseRepository<AudioFeaturesEntity, TrackId> {
  constructor() {
    super(db.audioFeatures);
  }

  async findUnanalyzedIds(): Promise<Result<TrackId[], Error>> {
    return attemptDb(async () => {
      const analyzed = await this.table
        .where("algorithmVersion")
        .aboveOrEqual(CURRENT_ALGORITHM_VERSION)
        .primaryKeys();

      const analyzedSet = new Set(analyzed);

      const allTrackIds = await db.tracks
        .toCollection()
        .primaryKeys();

      return allTrackIds.filter(id => !analyzedSet.has(id));
    });
  }

  async countAnalyzed(): Promise<Result<number, Error>> {
    return attemptDb(() => this.table
      .where("algorithmVersion")
      .aboveOrEqual(CURRENT_ALGORITHM_VERSION)
      .count());
  }

  async findManyByIds(trackIds: TrackId[]): Promise<Result<AudioFeaturesEntity[], Error>> {
    return attemptDb(async () => {
      if (trackIds.length === 0) return [];
      return this.table
        .where("trackId")
        .anyOf(trackIds)
        .toArray();
    });
  }
}

export const audioFeaturesRepository = new AudioFeaturesRepository();
