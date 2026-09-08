import type { AudioFeaturesEntity, ListenEventEntity, TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { audioFeaturesRepository } from "@/db/repositories/audioFeatures.repository";
import { SESSION_GAP_MS, statsRepository } from "@/db/repositories/stats.repository";
import { getLogger } from "@/lib/logger";
import type { TrackId } from "@/types/ids";
import { buildAffinityMap, DEFAULT_AFFINITY_OPTIONS } from "../lib/affinity";
import { computeFeatureStats, createAudioSpace } from "../lib/audio-similarity";
import { buildSessions, type Session } from "../lib/sessions";
import type { ScoringContext } from "../lib/scoring";
import { buildTransitions } from "../lib/transitions";

export const MAX_HISTORY_DAYS = 90;

/** How many of the most-recently-played unique tracks the context keeps for exclusion. */
const RECENT_LIMIT = 100;

export interface RecommenderContext extends ScoringContext {
  tracks: Map<TrackId, TrackEntity>;
  features: Map<TrackId, AudioFeaturesEntity>;
  /** All events — affinity decays them itself, and recentlyPlayed needs the full history. */
  events: ListenEventEntity[];
  sessions: Session[];
  /** Unique track ids from the most recently played, newest first (capped at RECENT_LIMIT). */
  recentlyPlayed: TrackId[];
  builtAt: number;
}

export interface BuildRecommenderContextInput {
  tracks: TrackEntity[];
  features: AudioFeaturesEntity[];
  events: ListenEventEntity[];
  now: number;
}

const recentlyPlayedOf = (events: readonly ListenEventEntity[], limit: number): TrackId[] => {
  const sorted = [...events].sort((a, b) => b.startedAt - a.startedAt);
  const seen = new Set<TrackId>();
  const out: TrackId[] = [];
  for (const e of sorted) {
    if (seen.has(e.trackId)) continue;
    seen.add(e.trackId);
    out.push(e.trackId);
    if (out.length >= limit) break;
  }
  return out;
};

/**
 * Pure assembly — no I/O — so training/evaluation can feed it a truncated
 * event window and the dev stand can rebuild it synchronously.
 */
export const buildRecommenderContext = (input: BuildRecommenderContextInput): RecommenderContext => {
  const { tracks, features, events, now } = input;

  // A like placed after `now` is future knowledge: with a training cutoff it
  // would leak the outcome into the features the model learns from.
  const likedIds = new Set<TrackId>();
  for (const t of tracks) if (t.likedAt !== undefined && t.likedAt <= now) likedIds.add(t.id);

  const affinity = buildAffinityMap(events, likedIds, { ...DEFAULT_AFFINITY_OPTIONS, now });

  const historyStart = now - MAX_HISTORY_DAYS * 86_400_000;
  const recentEvents = events.filter(e => e.startedAt >= historyStart);
  const sessions = buildSessions(recentEvents, SESSION_GAP_MS);
  const transitions = buildTransitions(sessions);

  const stats = computeFeatureStats(features);
  const audioSpace = stats ? createAudioSpace(stats) : null;

  return {
    now,
    tracks: new Map(tracks.map(t => [t.id, t])),
    features: new Map(features.map(f => [f.trackId, f])),
    events,
    sessions,
    recentlyPlayed: recentlyPlayedOf(events, RECENT_LIMIT),
    transitions,
    affinity,
    audioSpace,
    builtAt: now,
  };
};

let cached: RecommenderContext | null = null;
let pending: Promise<RecommenderContext> | null = null;
// Bumped by every dirty mark. A build started before a bump must not
// overwrite `cached` once it resolves after the bump — that would resurrect
// stale data the mark was raised to discard.
let generation = 0;

/** The next `getRecommenderContext()` rebuilds instead of serving the cached one. */
export const markRecommenderContextDirty = (): void => {
  cached = null;
  generation++;
};

interface LoadResult { ctx: RecommenderContext; hadError: boolean }

const loadRecommenderContext = async (): Promise<LoadResult> => {
  const now = Date.now();
  const [tracksResult, eventsResult, featuresResult] = await Promise.all([
    trackRepository.findAll(),
    statsRepository.findAllEvents(),
    audioFeaturesRepository.findAll(),
  ]);

  const hadError = tracksResult.isErr() || eventsResult.isErr() || featuresResult.isErr();
  if (tracksResult.isErr()) getLogger().error(`[Recommendations] Reading tracks failed: ${String(tracksResult.error)}`);
  if (eventsResult.isErr()) getLogger().error(`[Recommendations] Reading listen events failed: ${String(eventsResult.error)}`);
  if (featuresResult.isErr()) getLogger().error(`[Recommendations] Reading audio features failed: ${String(featuresResult.error)}`);

  const ctx = buildRecommenderContext({
    tracks: tracksResult.isOk() ? tracksResult.value : [],
    events: eventsResult.isOk() ? eventsResult.value : [],
    features: featuresResult.isOk() ? featuresResult.value : [],
    now,
  });
  return { ctx, hadError };
};

/**
 * Lazy, cached; concurrent calls while a build is in flight share it. A
 * failed repository read is served to this round's callers but never
 * cached, so the next call retries instead of freezing on an empty library.
 */
export const getRecommenderContext = async (): Promise<RecommenderContext> => {
  if (cached) return cached;
  if (!pending) {
    const gen = generation;
    pending = loadRecommenderContext()
      .then(({ ctx, hadError }) => {
        if (!hadError && gen === generation) cached = ctx;
        return ctx;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
};
