import type { ListenPick, TrackEntity } from "@/db/entities";
import type { QueueItem } from "@/modules/queue/types";
import type { TrackId } from "@/types/ids";
import type { MmrOptions } from "../lib/rank";
import {
  computeBreakdowns,
  scoreBreakdown,
  type Breakdown,
  type CandidateInput,
  type ComponentWeights,
  type ScoringContext,
} from "../lib/scoring";
import { buildSlate, exploreEligibility, type SlateCandidate } from "../lib/slate";
import type { RecommenderContext } from "./recommender-context.service";
import { pairKey, type FeedbackEntry, type FeedbackLabel } from "./stand-feedback.store";

export interface FeedEntry {
  track: TrackEntity;
  /** null for the seed the feed started from. */
  sourceId: TrackId | null;
  score: number;
  breakdown: Breakdown | null;
  pick: ListenPick;
}

export interface FeedRow extends FeedEntry {
  trackId: TrackId;
  label: FeedbackLabel | null;
}

export interface FeedSplit {
  current: FeedRow | null;
  upcoming: FeedRow[];
  /** Newest first. */
  past: FeedRow[];
}

export interface FeedPick {
  track: TrackEntity;
  score: number;
  breakdown: Breakdown;
  pick: ListenPick;
}

export interface FeedBatchOptions {
  limit: number;
  exploreShare: number;
  mmr: MmrOptions;
  allowExplore: boolean;
  rng: () => number;
}

export type FeedContext = ScoringContext & Pick<RecommenderContext, "tracks" | "features">;

export const pickFeedBatch = (
  ctx: FeedContext,
  seedId: TrackId,
  exclude: ReadonlySet<TrackId>,
  weights: ComponentWeights,
  opts: FeedBatchOptions,
): FeedPick[] => {
  const seedTrack = ctx.tracks.get(seedId);
  if (!seedTrack || opts.limit <= 0) return [];
  const candidates: CandidateInput[] = [];
  for (const [id, track] of ctx.tracks) {
    if (id === seedId || exclude.has(id)) continue;
    candidates.push({ track, features: ctx.features.get(id) ?? null });
  }
  if (candidates.length === 0) return [];
  const seed = { track: seedTrack, features: ctx.features.get(seedId) ?? null };
  const breakdowns = computeBreakdowns(ctx, seed, candidates);
  const scored = candidates.map((c, i) => ({
    trackId: c.track.id,
    artistIds: c.track.artistIds,
    albumId: c.track.albumId,
    score: scoreBreakdown(breakdowns[i], weights),
    track: c.track,
    breakdown: breakdowns[i],
  } satisfies SlateCandidate));
  const slate = buildSlate(scored, {
    limit: opts.limit,
    exploreShare: opts.exploreShare,
    mmr: opts.mmr,
    allowExplore: opts.allowExplore,
    isExploreEligible: exploreEligibility(ctx, ctx.now),
    rng: opts.rng,
  });
  return slate.map(({ item, pick }) => ({ track: item.track, score: item.score, breakdown: item.breakdown, pick }));
};

const rowOf = (
  item: QueueItem,
  feed: ReadonlyMap<TrackId, FeedEntry>,
  feedback: ReadonlyMap<string, FeedbackEntry>,
): FeedRow | null => {
  if (item.track.kind !== "library") return null;
  const entry = feed.get(item.track.id);
  if (!entry) return null;
  const label = entry.sourceId ? feedback.get(pairKey(entry.sourceId, item.track.id))?.label ?? null : null;
  return { ...entry, trackId: item.track.id, label };
};

export const splitFeed = (
  queue: readonly QueueItem[],
  currentIndex: number,
  feed: ReadonlyMap<TrackId, FeedEntry>,
  feedback: ReadonlyMap<string, FeedbackEntry>,
): FeedSplit => {
  const out: FeedSplit = { current: null, upcoming: [], past: [] };
  queue.forEach((item, i) => {
    const row = rowOf(item, feed, feedback);
    if (!row) return;
    if (i === currentIndex) out.current = row;
    else if (i > currentIndex) out.upcoming.push(row);
    else out.past.unshift(row);
  });
  return out;
};
