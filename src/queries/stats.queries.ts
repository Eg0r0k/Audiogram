import { statsRepository } from "@/db/repositories/stats.repository";
import {
  aggregateHourly,
  aggregateRecords,
  aggregateSummary,
  aggregateTopArtists,
  aggregateTopTracks,
  aggregateTotalSeconds,
} from "@/db/repositories/stats.aggregate";
import {
  artistRepository,
  trackRepository,
} from "@/db/repositories";
import type { ListenEventEntity } from "@/db/entities";
import { queryKeys } from "@/queries/query-keys";
import type { TrackId, ArtistId } from "@/types/ids";
import { keepPreviousData, queryOptions } from "@tanstack/vue-query";
import type { QueryClient } from "@tanstack/vue-query";
import { splitArtistNames } from "@/lib/artist-names";
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

export interface TopTrackEntry {
  id: string;
  count: number;
  secondsListened: number;
  track: ReturnType<typeof mapTrackEntityToPlayerTrack>;
}

const STATS_STALE_TIME = 5 * 60 * 1000;

/**
 * Remote artists have no row unless they are in the library; the track a
 * listen was recorded against still carries their name.
 */
const namesFromListenedTracks = async (
  events: readonly ListenEventEntity[],
  entries: readonly { id: string }[],
  known: ReadonlyMap<string, string>,
): Promise<Map<string, string>> => {
  const trackIdByArtist = new Map<string, TrackId>();
  for (const entry of entries) {
    if (!entry.id || known.has(entry.id)) continue;
    const listen = events.find(event => event.artistId === entry.id);
    if (listen) trackIdByArtist.set(entry.id, listen.trackId);
  }
  if (trackIdByArtist.size === 0) return new Map();

  const tracks = await unwrapResult(trackRepository.findByIds([...new Set(trackIdByArtist.values())]));
  const tracksById = new Map(tracks.map(track => [track.id as string, track]));
  const names = new Map<string, string>();
  for (const [artistId, trackId] of trackIdByArtist) {
    const track = tracksById.get(trackId);
    if (!track?.artistName) continue;
    const credits = splitArtistNames(track.artistName);
    const position = track.artistIds.indexOf(artistId as ArtistId);
    const lineUp = position >= 0 && credits.length === track.artistIds.length;
    names.set(artistId, lineUp ? credits[position] : track.artistName);
  }
  return names;
};

// The stats page mounts ~8 aggregates for one period. Each aggregate query
// resolves the period's events through the shared `events` query (one
// listenEvents read, deduped by TanStack) and reduces them in memory.
const eventsQuery = (since?: number) =>
  queryOptions({
    queryKey: queryKeys.stats.events(since),
    queryFn: (): Promise<ListenEventEntity[]> => unwrapResult(statsRepository.eventsSince(since)),
    staleTime: STATS_STALE_TIME,
    // Structural sharing exists to keep references stable for consumers that
    // compare by identity; the aggregates reduce this array to numbers and
    // nobody holds it. On a history with no ceiling the deep walk it costs on
    // every refetch buys nothing.
    structuralSharing: false,
  });

// fetchQuery, not ensureQueryData: the events entry has no observer, so an
// invalidation only marks it stale, and ensureQueryData hands stale data back.
const eventsOf = (client: QueryClient, since?: number) => client.fetchQuery(eventsQuery(since));

export const statsQueries = {
  events: eventsQuery,
  hasHistory: () =>
    queryOptions({
      queryKey: queryKeys.stats.hasHistory(),
      queryFn: () => unwrapResult(statsRepository.hasEvents()),
      staleTime: STATS_STALE_TIME,
    }),
  // Ряды топов собираются одним запросом (события + метаданные), чтобы при
  // смене периода не было второй волны загрузки на meta-ключе.
  topTracks: (limit: number, since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.topTracks(limit, since),
      queryFn: async ({ client }): Promise<TopTrackEntry[]> => {
        const entries = aggregateTopTracks(await eventsOf(client, since), limit);
        const tracks = await unwrapResult(
          trackRepository.findByIds(entries.map(entry => entry.id as TrackId)),
        );
        const tracksById = new Map(
          tracks.map(track => [track.id as string, mapTrackEntityToPlayerTrack(track)]),
        );

        return entries.flatMap((entry) => {
          const track = tracksById.get(entry.id);
          return track ? [{ ...entry, track }] : [];
        });
      },
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  topTracksMeta: (ids: readonly string[]) =>
    queryOptions({
      queryKey: queryKeys.stats.topTracksMeta(ids),
      queryFn: () => unwrapResult(trackRepository.findByIds(ids as TrackId[])),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  topArtists: (limit: number, since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.topArtists(limit, since),
      queryFn: async ({ client }) => {
        const events = await eventsOf(client, since);
        const entries = aggregateTopArtists(events, limit);
        const artists = await unwrapResult(
          artistRepository.findByIds(entries.map(entry => entry.id as ArtistId)),
        );
        const namesById = new Map(artists.map(artist => [artist.id as string, artist.name]));
        for (const [id, name] of await namesFromListenedTracks(events, entries, namesById)) {
          namesById.set(id, name);
        }

        return entries.flatMap((entry) => {
          const name = namesById.get(entry.id);
          return name ? [{ ...entry, artist: { id: entry.id, name } }] : [];
        });
      },
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  artistPlays: (artistId: string) =>
    queryOptions({
      queryKey: queryKeys.stats.artistPlays(artistId),
      queryFn: () => unwrapResult(statsRepository.artistPlaysCount(artistId)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  topGenres: (limit: number, since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.topGenres(limit, since),
      queryFn: async ({ client }) =>
        unwrapResult(statsRepository.topGenresOf(await eventsOf(client, since), limit)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  totalTime: (since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.totalTime(since),
      queryFn: async ({ client }) => aggregateTotalSeconds(await eventsOf(client, since)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  dailyActivity: (days: number) =>
    queryOptions({
      queryKey: queryKeys.stats.dailyActivity(days),
      // dailyActivity уже возвращает непрерывный массив {date, seconds}[] с нулями в пропусках
      queryFn: () => unwrapResult(statsRepository.dailyActivity(days)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  summary: (since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.summary(since),
      queryFn: async ({ client }) => aggregateSummary(await eventsOf(client, since)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  hourlyActivity: (since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.hourlyActivity(since),
      queryFn: async ({ client }) => aggregateHourly(await eventsOf(client, since)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  records: (since?: number) =>
    queryOptions({
      queryKey: queryKeys.stats.records(since),
      queryFn: async ({ client }) => aggregateRecords(await eventsOf(client, since)),
      staleTime: STATS_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
  streaks: () =>
    queryOptions({
      queryKey: queryKeys.stats.streaks(),
      queryFn: () => unwrapResult(statsRepository.streaks()),
      staleTime: STATS_STALE_TIME,
    }),
  recentHistory: (limit: number) =>
    queryOptions({
      queryKey: queryKeys.stats.recentHistory(limit),
      queryFn: async (): Promise<RecentHistoryEntry[]> => {
        const events = await unwrapResult(statsRepository.recentHistory(limit));
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
