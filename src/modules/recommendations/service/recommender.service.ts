import type { ListenEventEntity, TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { DEFAULT_MMR_OPTIONS, mmrSelect, type MmrCandidate } from "../lib/rank";
import { DEFAULT_WEIGHTS, scoreCandidates, type Breakdown, type CandidateInput, type SeedInput } from "../lib/scoring";
import { getRecommenderContext } from "./recommender-context.service";

export interface ScoredTrack {
  trackId: TrackId;
  track: TrackEntity;
  score: number;
  breakdown: Breakdown;
}

/** Tracks played this recently are excluded from candidates alongside the seed. */
export const RECENT_EXCLUDE = 3;

/** Unique track ids from the most recently played, newest first. */
export const recentlyPlayedIds = (events: readonly ListenEventEntity[], count: number): TrackId[] => {
  const sorted = [...events].sort((a, b) => b.startedAt - a.startedAt);
  const seen = new Set<TrackId>();
  const out: TrackId[] = [];
  for (const e of sorted) {
    if (seen.has(e.trackId)) continue;
    seen.add(e.trackId);
    out.push(e.trackId);
    if (out.length >= count) break;
  }
  return out;
};

export const getRecommendations = async (
  sourceTrackId: TrackId,
  limit = 8,
  additionalExcludeIds: TrackId[] = [],
): Promise<ScoredTrack[]> => {
  const ctx = await getRecommenderContext();
  const seedTrack = ctx.tracks.get(sourceTrackId);
  if (!seedTrack) return [];

  const excluded = new Set<TrackId>(additionalExcludeIds);
  excluded.add(sourceTrackId);
  for (const id of recentlyPlayedIds(ctx.events, RECENT_EXCLUDE)) excluded.add(id);

  const candidates: CandidateInput[] = [];
  for (const [id, track] of ctx.tracks) {
    if (excluded.has(id)) continue;
    candidates.push({ track, features: ctx.features.get(id) ?? null });
  }
  if (candidates.length === 0) return [];

  // Task 10 replaces this with `await getActiveWeights()`.
  const weights = DEFAULT_WEIGHTS;
  const seed: SeedInput = { track: seedTrack, features: ctx.features.get(sourceTrackId) ?? null };
  const scored = scoreCandidates(ctx, seed, candidates, weights);

  const mmrCandidates = scored.map(c => ({
    trackId: c.track.id,
    artistIds: c.track.artistIds,
    albumId: c.track.albumId,
    score: c.score,
    track: c.track,
    breakdown: c.breakdown,
  } satisfies MmrCandidate & { track: TrackEntity; breakdown: Breakdown }));

  const picked = mmrSelect(mmrCandidates, limit, DEFAULT_MMR_OPTIONS);

  return picked.map(p => ({
    trackId: p.trackId,
    track: p.track,
    score: p.score,
    breakdown: p.breakdown,
  }));
};
