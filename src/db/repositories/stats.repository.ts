import { db } from "@/db";
import type { ListenEventEntity } from "@/db/entities";
import { tableOf, type TableMap, type TableSource } from "@/db/tables";
import type { TagId, TrackId } from "@/types/ids";
import { guarded } from "./base.repository";
import {
  aggregateHourly,
  aggregateRecords,
  aggregateSummary,
  aggregateTopArtists,
  aggregateTopTracks,
  aggregateTotalSeconds,
  localDayKey,
  type StatsRecords,
  type StatsSummary,
  type TopEntry,
} from "./stats.aggregate";

export { SESSION_GAP_MS, type StatsRecords, type StatsSummary, type TopEntry } from "./stats.aggregate";

export interface TopGenreEntry {
  id: TagId | "other";
  name: string;
  count: number;
  secondsListened: number;
}

export interface DailyActivityPoint {
  date: string; // YYYY-MM-DD
  seconds: number;
}

export interface StreakInfo {
  current: number;
  best: number;
}

export class StatsRepository {
  private readonly listenEvents: TableMap["listenEvents"];
  private readonly tracks: TableMap["tracks"];
  private readonly tags: TableMap["tags"];

  constructor(source: TableSource = db) {
    this.listenEvents = tableOf(source, "listenEvents");
    this.tracks = tableOf(source, "tracks");
    this.tags = tableOf(source, "tags");
  }

  /**
   * A native count over the store: "is there any history" must not load a
   * history that has no ceiling — only a chosen period is worth rows.
   */
  async hasEvents(): Promise<boolean> {
    return guarded(async () => (await this.listenEvents.count()) > 0);
  }

  /**
   * Events of a period — the single read the stats page aggregates share
   * (see stats.queries). `since` undefined = all time.
   */
  async eventsSince(since?: number): Promise<ListenEventEntity[]> {
    return guarded(() => since
      ? this.listenEvents.where("startedAt").aboveOrEqual(since).toArray()
      : this.listenEvents.toArray());
  }

  /**
   * Последние прослушанные треки, без повторов: если трек прослушивался
   * много раз, в списке остаётся только его самое недавнее прослушивание
   * (трек просто "поднимается" наверх при повторном воспроизведении —
   * как это обычно устроено в "Recently played").
   */
  async recentHistory(limit = 100): Promise<ListenEventEntity[]> {
    return guarded(async () => {
      const seenTrackIds = new Set<TrackId>();
      const result: ListenEventEntity[] = [];

      const BATCH_SIZE = Math.max(limit * 5, 200);
      let offset = 0;

      while (result.length < limit) {
        const batch = await this.listenEvents
          .orderBy("startedAt")
          .reverse()
          .offset(offset)
          .limit(BATCH_SIZE)
          .toArray();

        if (batch.length === 0) break;

        for (const event of batch) {
          if (seenTrackIds.has(event.trackId)) continue;
          seenTrackIds.add(event.trackId);
          result.push(event);
          if (result.length >= limit) break;
        }

        offset += batch.length;
        if (batch.length < BATCH_SIZE) break;
      }

      return result;
    });
  }

  async topTracks(limit = 10, since?: number): Promise<TopEntry[]> {
    return aggregateTopTracks(await this.eventsSince(since), limit);
  }

  async topArtists(limit = 10, since?: number): Promise<TopEntry[]> {
    return aggregateTopArtists(await this.eventsSince(since), limit);
  }

  async artistPlaysCount(artistId: string): Promise<number> {
    return guarded(() =>
      this.listenEvents.where("artistId").equals(artistId).and(e => !e.skipped).count(),
    );
  }

  async topGenres(limit = 8, since?: number): Promise<TopGenreEntry[]> {
    return this.topGenresOf(await this.eventsSince(since), limit);
  }

  /** Genre ranking over already-loaded events (needs the tracks' tags from the DB). */
  async topGenresOf(events: readonly ListenEventEntity[], limit = 8): Promise<TopGenreEntry[]> {
    return guarded(async () => {
      const played = events.filter(e => !e.skipped);
      if (played.length === 0) return [];

      const trackIds = [...new Set(played.map(e => e.trackId))];
      const tracks = (await this.tracks.bulkGet(trackIds)).filter(t => t !== undefined);
      const trackTagMap = new Map(tracks.map(t => [t.id, t.tagIds]));

      const allTagIds = [...new Set(tracks.flatMap(t => t.tagIds))];
      const tags = (await this.tags.bulkGet(allTagIds)).filter(t => t !== undefined);
      const tagNameMap = new Map(tags.map(t => [t.id, t.name]));

      const map = new Map<string, TopGenreEntry>();
      for (const e of played) {
        for (const tagId of trackTagMap.get(e.trackId) ?? []) {
          const entry = map.get(tagId) ?? {
            id: tagId,
            name: tagNameMap.get(tagId) ?? "",
            count: 0,
            secondsListened: 0,
          };
          entry.count++;
          entry.secondsListened += e.secondsListened;
          map.set(tagId, entry);
        }
      }
      return [...map.values()].sort((a, b) => b.secondsListened - a.secondsListened).slice(0, limit);
    });
  }

  async totalListeningSeconds(since?: number): Promise<number> {
    return aggregateTotalSeconds(await this.eventsSince(since));
  }

  async summary(since?: number): Promise<StatsSummary> {
    return aggregateSummary(await this.eventsSince(since));
  }

  async deleteAllEvents(): Promise<void> {
    return guarded(async () => {
      await this.listenEvents.clear();
    });
  }

  async dailyActivity(days = 30): Promise<DailyActivityPoint[]> {
    return guarded(async () => {
      const since = Date.now() - days * 86_400_000;
      const events = await this.listenEvents.where("startedAt").aboveOrEqual(since).toArray();

      const map = new Map<string, number>();
      for (const e of events) {
        const day = localDayKey(new Date(e.startedAt));
        map.set(day, (map.get(day) ?? 0) + e.secondsListened);
      }

      const points: DailyActivityPoint[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = localDayKey(new Date(Date.now() - i * 86_400_000));
        points.push({ date, seconds: map.get(date) ?? 0 });
      }
      return points;
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    return guarded(() => this.listenEvents.delete(eventId));
  }

  eventsForTrack = async (trackId: TrackId): Promise<ListenEventEntity[]> =>
    guarded(() => this.listenEvents.where("trackId").equals(trackId).toArray());

  restoreEvents = async (events: readonly ListenEventEntity[]): Promise<void> =>
    guarded(async () => {
      await this.listenEvents.bulkPut([...events]);
    });

  async deleteEventsForTrack(trackId: TrackId): Promise<void> {
    return guarded(async () => {
      await this.listenEvents.where("trackId").equals(trackId).delete();
    });
  }

  async hourlyActivity(since?: number): Promise<number[]> {
    return aggregateHourly(await this.eventsSince(since));
  }

  async records(since?: number): Promise<StatsRecords> {
    return aggregateRecords(await this.eventsSince(since));
  }

  async streaks(now = Date.now()): Promise<StreakInfo> {
    return guarded(async () => {
      const DAYS = 365;
      const since = now - DAYS * 86_400_000;
      const events = await this.listenEvents.where("startedAt").aboveOrEqual(since).toArray();

      const activeDays = new Set<string>();
      for (const e of events) {
        if (e.secondsListened <= 0) continue;
        activeDays.add(localDayKey(new Date(e.startedAt)));
      }

      let best = 0;
      let run = 0;
      for (let i = DAYS; i >= 0; i--) {
        if (activeDays.has(localDayKey(new Date(now - i * 86_400_000)))) {
          run++;
          best = Math.max(best, run);
        }
        else {
          run = 0;
        }
      }

      // Текущая серия: сегодня без прослушиваний ещё не разрыв — день не кончился.
      let current = 0;
      const startOffset = activeDays.has(localDayKey(new Date(now))) ? 0 : 1;
      for (let i = startOffset; i <= DAYS; i++) {
        if (!activeDays.has(localDayKey(new Date(now - i * 86_400_000)))) break;
        current++;
      }

      return { current, best };
    });
  }
}

export const statsRepository = new StatsRepository();
