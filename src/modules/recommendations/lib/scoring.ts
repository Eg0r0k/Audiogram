import type { AudioFeaturesEntity, TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import type { AffinityEntry } from "./affinity";
import type { AudioSpace } from "./audio-similarity";
import { percentileRanks } from "./rank";
import type { Transitions } from "./transitions";
import { transitionWeight } from "./transitions";

export const COMPONENT_KEYS = ["audio", "trackTransition", "artistTransition", "affinity", "explore"] as const;
export type ComponentKey = typeof COMPONENT_KEYS[number];
export type ComponentWeights = Record<ComponentKey, number>;

export const DEFAULT_WEIGHTS: ComponentWeights = {
  audio: 0.35,
  trackTransition: 0.25,
  artistTransition: 0.10,
  affinity: 0.20,
  explore: 0.10,
};

export type RecencyPenaltyTiers = { withinMs: number; penalty: number }[];

export const DEFAULT_RECENCY_TIERS: RecencyPenaltyTiers = [
  { withinMs: 6 * 3_600_000, penalty: -0.3 },
  { withinMs: 24 * 3_600_000, penalty: -0.1 },
];

export interface ScoringContext {
  now: number;
  audioSpace: AudioSpace | null;
  transitions: Transitions;
  affinity: Map<TrackId, AffinityEntry>;
}

export interface SeedInput { track: TrackEntity; features: AudioFeaturesEntity | null }
export interface CandidateInput { track: TrackEntity; features: AudioFeaturesEntity | null }

export type ComponentRanks = Record<ComponentKey, number>;

export interface Breakdown {
  /** Raw 0..1, or null when the seed or the candidate has no audio features. */
  audioSimilarity: number | null;
  trackTransition: number;
  artistTransition: number;
  affinity: number;
  explore: 0 | 1;
  recencyPenalty: number;
  /** What actually gets multiplied by the weights. */
  ranks: ComponentRanks;
}

export interface ScoredCandidate { track: TrackEntity; score: number; breakdown: Breakdown }

const recencyPenaltyOf = (
  track: TrackEntity,
  now: number,
  tiers: RecencyPenaltyTiers,
): number => {
  if (track.lastPlayedAt === undefined) return 0;
  const age = Math.max(0, now - track.lastPlayedAt);
  // Tiers must be sorted ascending by withinMs — first match wins.
  for (const tier of tiers) {
    if (age <= tier.withinMs) return tier.penalty;
  }
  return 0;
};

/**
 * Per-candidate raw components + percentile ranks against the candidate set.
 * Weight-independent so the stand (Task 8) can cache this per source and
 * only recompute `scoreBreakdown` when the sliders move.
 */
export const computeBreakdowns = (
  ctx: ScoringContext,
  seed: SeedInput,
  candidates: readonly CandidateInput[],
  recencyTiers: RecencyPenaltyTiers = DEFAULT_RECENCY_TIERS,
): Breakdown[] => {
  const n = candidates.length;
  const seedVector = ctx.audioSpace && seed.features ? ctx.audioSpace.encode(seed.features) : null;
  const seedArtist = seed.track.artistIds[0];

  const rawAudio = new Array<number | null>(n);
  const rawTrackTransition = new Array<number>(n);
  const rawArtistTransition = new Array<number>(n);
  const rawAffinity = new Array<number>(n);
  const rawExplore = new Array<0 | 1>(n);
  const recencyPenalties = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const cand = candidates[i];

    rawAudio[i] = seedVector && ctx.audioSpace && cand.features !== null
      ? ctx.audioSpace.similarity(seedVector, ctx.audioSpace.encode(cand.features))
      : null;

    rawTrackTransition[i] = transitionWeight(ctx.transitions.tracks, seed.track.id, cand.track.id);

    const candArtist = cand.track.artistIds[0];
    rawArtistTransition[i] = seedArtist && candArtist
      ? transitionWeight(ctx.transitions.artists, seedArtist, candArtist)
      : 0;

    const affinityEntry = ctx.affinity.get(cand.track.id);
    rawAffinity[i] = affinityEntry?.score ?? 0;
    rawExplore[i] = !affinityEntry && cand.features !== null ? 1 : 0;

    recencyPenalties[i] = recencyPenaltyOf(cand.track, ctx.now, recencyTiers);
  }

  const audioIdx: number[] = [];
  const audioVals: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = rawAudio[i];
    if (v !== null) {
      audioIdx.push(i);
      audioVals.push(v);
    }
  }
  const audioRankedSubset = percentileRanks(audioVals);
  const audioRanks = new Array<number>(n).fill(0.5);
  for (let k = 0; k < audioIdx.length; k++) audioRanks[audioIdx[k]] = audioRankedSubset[k];

  const trackTransitionRanks = percentileRanks(rawTrackTransition);
  const artistTransitionRanks = percentileRanks(rawArtistTransition);
  const affinityRanks = percentileRanks(rawAffinity);

  const out = new Array<Breakdown>(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      audioSimilarity: rawAudio[i],
      trackTransition: rawTrackTransition[i],
      artistTransition: rawArtistTransition[i],
      affinity: rawAffinity[i],
      explore: rawExplore[i],
      recencyPenalty: recencyPenalties[i],
      ranks: {
        audio: audioRanks[i],
        trackTransition: trackTransitionRanks[i],
        artistTransition: artistTransitionRanks[i],
        affinity: affinityRanks[i],
        explore: rawExplore[i],
      },
    };
  }
  return out;
};

export const scoreBreakdown = (b: Breakdown, weights: ComponentWeights): number => {
  let s = 0;
  for (const k of COMPONENT_KEYS) s += weights[k] * b.ranks[k];
  return s + b.recencyPenalty;
};

export const scoreCandidates = (
  ctx: ScoringContext,
  seed: SeedInput,
  candidates: readonly CandidateInput[],
  weights: ComponentWeights = DEFAULT_WEIGHTS,
  recencyTiers: RecencyPenaltyTiers = DEFAULT_RECENCY_TIERS,
): ScoredCandidate[] => {
  const breakdowns = computeBreakdowns(ctx, seed, candidates, recencyTiers);
  return candidates.map((c, i) => ({
    track: c.track,
    score: scoreBreakdown(breakdowns[i], weights),
    breakdown: breakdowns[i],
  }));
};

export const ranksToVector = (r: ComponentRanks): number[] => COMPONENT_KEYS.map(k => r[k]);
