import { db } from "@/db";
import type { AudioFeaturesEntity } from "@/db/entities";
import { tableOf, type TableMap, type TableSource } from "@/db/tables";
import { BaseRepository, guarded } from "./base.repository";
import type { TrackId } from "@/types/ids";

export const CURRENT_ALGORITHM_VERSION = 1;

export class AudioFeaturesRepository extends BaseRepository<AudioFeaturesEntity, TrackId> {
  private readonly tracks: TableMap["tracks"];

  constructor(source: TableSource = db) {
    super(tableOf(source, "audioFeatures"));
    this.tracks = tableOf(source, "tracks");
  }

  async findUnanalyzedIds(): Promise<TrackId[]> {
    return guarded(async () => {
      const analyzed = await this.table
        .where("algorithmVersion")
        .aboveOrEqual(CURRENT_ALGORITHM_VERSION)
        .primaryKeys();

      const analyzedSet = new Set(analyzed);

      const allTrackIds = await this.tracks
        .toCollection()
        .primaryKeys();

      return allTrackIds.filter(id => !analyzedSet.has(id));
    });
  }

  async countAnalyzed(): Promise<number> {
    return guarded(() => this.table
      .where("algorithmVersion")
      .aboveOrEqual(CURRENT_ALGORITHM_VERSION)
      .count());
  }

  async findManyByIds(trackIds: TrackId[]): Promise<AudioFeaturesEntity[]> {
    return guarded(async () => {
      if (trackIds.length === 0) return [];
      return this.table
        .where("trackId")
        .anyOf(trackIds)
        .toArray();
    });
  }
}

export const audioFeaturesRepository = new AudioFeaturesRepository();
