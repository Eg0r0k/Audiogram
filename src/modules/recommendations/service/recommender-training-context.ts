import type { AudioFeaturesEntity, TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { makeLcg } from "../lib/random";
import type { CandidateInput, ScoringContext } from "../lib/scoring";
import { buildRecommenderContext, type RecommenderContext } from "./recommender-context.service";

/** Fixed so training/eval reports over the same library are reproducible run to run. */
const SAMPLE_SEED = 42;

/**
 * `buildContextAt` for `buildExamples`: tracks/features stay the current
 * library, only the event window (and derived affinity/transitions) is
 * truncated to `< cutoff` — matching what the model would have seen live.
 */
export const buildContextAtFactory = (ctx: RecommenderContext) => {
  const tracks = [...ctx.tracks.values()];
  const features = [...ctx.features.values()];
  return (cutoff: number): {
    ctx: ScoringContext;
    tracks: Map<TrackId, TrackEntity>;
    features: Map<TrackId, AudioFeaturesEntity>;
  } => {
    const built = buildRecommenderContext({
      tracks,
      features,
      events: ctx.events.filter(e => e.startedAt < cutoff),
      now: cutoff,
    });
    return { ctx: built, tracks: built.tracks, features: built.features };
  };
};

/** Deterministic, without-replacement sampling over the current context's track ids. */
export const sampleCandidatesFactory = (ctx: RecommenderContext) => {
  const ids = [...ctx.tracks.keys()];
  return (n: number, exclude: ReadonlySet<TrackId>): CandidateInput[] => {
    const pool = ids.filter(id => !exclude.has(id));
    const rnd = makeLcg(SAMPLE_SEED);
    const take = Math.min(n, pool.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(rnd() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, take).map(id => ({ track: ctx.tracks.get(id)!, features: ctx.features.get(id) ?? null }));
  };
};
