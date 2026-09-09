import type { ListenPick, TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { adaptiveExploreShare, exploreAllowedAfter } from "../lib/explore-policy";
import { DEFAULT_MMR_OPTIONS } from "../lib/rank";
import { scoreCandidates, type Breakdown, type CandidateInput, type SeedInput } from "../lib/scoring";
import { buildSlate, DEFAULT_EXPLORE_SHARE, exploreEligibility, type SlateCandidate } from "../lib/slate";
import { getRecommenderContext } from "./recommender-context.service";
import { ensureModelFresh, getActiveWeights } from "./recommender-model.service";

export interface ScoredTrack {
  trackId: TrackId;
  track: TrackEntity;
  score: number;
  breakdown: Breakdown;
  pick: ListenPick;
}

export interface RecommendationDeps {
  rng: () => number;
  now: number;
}

/** Tracks played this recently are excluded from candidates alongside the seed. */
export const RECENT_EXCLUDE = 3;

export const getRecommendations = async (
  sourceTrackId: TrackId,
  limit = 8,
  additionalExcludeIds: TrackId[] = [],
  deps: Partial<RecommendationDeps> = {},
): Promise<ScoredTrack[]> => {
  const rng = deps.rng ?? Math.random;
  // Fresh clock: the cached context can be hours old, but recency tiers must
  // score against "now", not the context's build time.
  const now = deps.now ?? Date.now();

  const ctx = await getRecommenderContext();
  const seedTrack = ctx.tracks.get(sourceTrackId);
  if (!seedTrack) return [];

  const excluded = new Set<TrackId>(additionalExcludeIds);
  excluded.add(sourceTrackId);
  for (const id of ctx.recentlyPlayed.slice(0, RECENT_EXCLUDE)) excluded.add(id);

  const candidates: CandidateInput[] = [];
  for (const [id, track] of ctx.tracks) {
    if (excluded.has(id)) continue;
    candidates.push({ track, features: ctx.features.get(id) ?? null });
  }
  if (candidates.length === 0) return [];

  const weights = await getActiveWeights();
  const seed: SeedInput = { track: seedTrack, features: ctx.features.get(sourceTrackId) ?? null };
  const scoringCtx = { ...ctx, now };
  const scored = scoreCandidates(scoringCtx, seed, candidates, weights);

  const slateCandidates = scored.map(c => ({
    trackId: c.track.id,
    artistIds: c.track.artistIds,
    albumId: c.track.albumId,
    score: c.score,
    track: c.track,
    breakdown: c.breakdown,
  } satisfies SlateCandidate));

  const slate = buildSlate(slateCandidates, {
    limit,
    exploreShare: adaptiveExploreShare(ctx.events, DEFAULT_EXPLORE_SHARE),
    mmr: DEFAULT_MMR_OPTIONS,
    allowExplore: exploreAllowedAfter(ctx.events),
    isExploreEligible: exploreEligibility(ctx, now),
    rng,
  });

  ensureModelFresh().catch(() => {});
  return slate.map(({ item, pick }) => ({
    trackId: item.trackId,
    track: item.track,
    score: item.score,
    breakdown: item.breakdown,
    pick,
  }));
};
