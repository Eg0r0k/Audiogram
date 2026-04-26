import { statsRepository } from "@/db/repositories/stats.repository";
import {
  artistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import type { TrackId, ArtistId } from "@/types/ids";
import { queryOptions } from "@tanstack/vue-query";
import type { QueryClient } from "@tanstack/vue-query";
import { unwrapResult } from "./shared";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";

export interface RecentHistoryEntry {
  eventId: string;
  listenedAt: number;
  secondsListened: number;
  completed: boolean;
  skipped: boolean;
  track: ReturnType<typeof mapTrackEntityToPlayerTrack>;
}

const STATS_STALE_TIME = 5 * 60 * 1000;

export const statsQueries = {
  topTracks: (limit: number, since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.topTracks(limit, since),
      queryFn: () => statsRepository.topTracks(limit, since),
      staleTime: STATS_STALE_TIME,
    }),
  topTracksMeta: (ids: readonly string[]) =>
    queryOptions({
      queryKey: queryKeys.stats.topTracksMeta(ids),
      queryFn: async () => {
        const tracks = await unwrapResult(trackRepository.findByIds(ids as TrackId[]));
        return tracks;
      },
      staleTime: STATS_STALE_TIME,
    }),
  topArtists: (limit: number, since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.topArtists(limit, since),
      queryFn: () => statsRepository.topArtists(limit, since),
      staleTime: STATS_STALE_TIME,
    }),
  topArtistsMeta: (ids: readonly string[]) =>
    queryOptions({
      queryKey: queryKeys.stats.topArtistsMeta(ids),
      queryFn: async () => {
        const artists = await unwrapResult(artistRepository.findByIds(ids as ArtistId[]));
        return artists;
      },
      staleTime: STATS_STALE_TIME,
    }),
  totalTime: (since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.totalTime(since),
      queryFn: () => statsRepository.totalListeningSeconds(since),
      staleTime: STATS_STALE_TIME,
    }),
  dailyActivity: (days: number) =>
    queryOptions({
      queryKey: queryKeys.stats.dailyActivity(days),
      queryFn: async () => {
        const activity = await statsRepository.dailyActivity(days);
        return Array.from(activity.entries()).map(([date, seconds]) => ({ date, seconds }));
      },
      staleTime: STATS_STALE_TIME,
    }),
  recentHistory: (limit: number) =>
    queryOptions({
      queryKey: queryKeys.stats.recentHistory(limit),
      queryFn: async (): Promise<RecentHistoryEntry[]> => {
        const events = await statsRepository.recentHistory(limit);
        const trackIds = events.map(event => event.trackId);
        const tracks = await unwrapResult(trackRepository.findByIds(trackIds));
        const tracksById = new Map(tracks.map(track => [track.id, mapTrackEntityToPlayerTrack(track)]));

        return events.flatMap((event) => {
          const track = tracksById.get(event.trackId);
          if (!track) return [];

          return [{
            eventId: event.id,
            listenedAt: event.startedAt,
            secondsListened: event.secondsListened,
            completed: event.completed,
            skipped: event.skipped,
            track,
          }];
        });
      },
      staleTime: 10_000,
    }),
} as const;

export function invalidateStatsQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.stats.all() });
}
