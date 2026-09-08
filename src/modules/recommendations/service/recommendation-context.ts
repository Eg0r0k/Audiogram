import type { ListenEventEntity, TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { statsRepository } from "@/db/repositories/stats.repository";
import type { ArtistId, TrackId } from "@/types/ids";
import {
  buildCoOccurrence,
  groupSessions,
  MAX_HISTORY_DAYS,
  toArtistSessions,
  toTrackSessions,
  type CoOccurrence,
  type Session,
} from "./session-builder.service";

export interface TrackStats { completed: number; total: number; skipped: number; seconds: number }

export interface RecommendationContext {
  now: number;
  tracks: Map<TrackId, TrackEntity>;
  trackSessions: Session[];
  trackCo: CoOccurrence<TrackId>;
  artistCo: CoOccurrence<ArtistId>;
  trackStats: Map<TrackId, TrackStats>;
  artistSeconds: Map<ArtistId, number>;
  maxArtistSeconds: number;
  recentlyPlayed: TrackId[];
}

export const RECENT_LIMIT = 100;

const recentlyPlayedOf = (events: ListenEventEntity[]): TrackId[] => {
  const sorted = [...events].sort((a, b) => b.startedAt - a.startedAt);
  const seen = new Set<TrackId>();
  const out: TrackId[] = [];
  for (const e of sorted) {
    if (seen.has(e.trackId)) continue;
    seen.add(e.trackId);
    out.push(e.trackId);
    if (out.length >= RECENT_LIMIT) break;
  }
  return out;
};

export const buildRecommendationContextFromData = (
  tracks: TrackEntity[],
  events: ListenEventEntity[],
  now = Date.now(),
): RecommendationContext => {
  const trackStats = new Map<TrackId, TrackStats>();
  const artistSeconds = new Map<ArtistId, number>();
  let maxArtistSeconds = 0;

  for (const e of events) {
    let s = trackStats.get(e.trackId);
    if (!s) {
      s = { completed: 0, total: 0, skipped: 0, seconds: 0 };
      trackStats.set(e.trackId, s);
    }
    s.total++;
    if (e.skipped) s.skipped++;
    else if (e.completed) s.completed++;
    s.seconds += e.secondsListened;

    const sec = (artistSeconds.get(e.artistId) ?? 0) + e.secondsListened;
    artistSeconds.set(e.artistId, sec);
    if (sec > maxArtistSeconds) maxArtistSeconds = sec;
  }

  const groups = groupSessions(events);
  const trackSessions = toTrackSessions(groups);

  return {
    now,
    tracks: new Map(tracks.map(t => [t.id, t])),
    trackSessions,
    trackCo: buildCoOccurrence(trackSessions),
    artistCo: buildCoOccurrence(toArtistSessions(groups)),
    trackStats,
    artistSeconds,
    maxArtistSeconds,
    recentlyPlayed: recentlyPlayedOf(events),
  };
};

export const buildRecommendationContext = async (): Promise<RecommendationContext> => {
  const now = Date.now();
  const [tracksResult, eventsResult] = await Promise.all([
    trackRepository.findAll(),
    statsRepository.eventsSince(now - MAX_HISTORY_DAYS * 86_400_000),
  ]);
  return buildRecommendationContextFromData(
    tracksResult.isOk() ? tracksResult.value : [],
    eventsResult.isOk() ? eventsResult.value : [],
    now,
  );
};

export const candidateIdsFor = (
  sourceId: TrackId,
  ctx: RecommendationContext,
  recentWindow: number,
  exclude: Iterable<TrackId>,
): TrackId[] => {
  const excluded = new Set<TrackId>(exclude);
  excluded.add(sourceId);
  for (const id of ctx.recentlyPlayed.slice(0, Math.max(0, recentWindow))) excluded.add(id);
  const out: TrackId[] = [];
  for (const id of ctx.tracks.keys()) if (!excluded.has(id)) out.push(id);
  return out;
};
