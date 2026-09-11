import type { AudioFeaturesEntity, TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { makeLcg } from "../lib/random";
import type { CandidateInput, ScoringContext } from "../lib/scoring";
import { buildRecommenderContext, type RecommenderContext } from "./recommender-context.service";

/** Fixed so training/eval reports over the same library are reproducible run to run. */
const SAMPLE_SEED = 42;

/**
 * `buildContextAt` for `buildExamples`: the event window (and the derived
 * affinity/transitions) is truncated to `< cutoff`, and so is the library —
 * a track imported after the cutoff did not exist for the live recommender
 * and must not appear as a candidate or shift the feature statistics.
 */
export const buildContextAtFactory = (ctx: RecommenderContext) => {
  const tracks = [...ctx.tracks.values()];
  const features = [...ctx.features.values()];
  return (cutoff: number): {
    ctx: ScoringContext;
    tracks: Map<TrackId, TrackEntity>;
    features: Map<TrackId, AudioFeaturesEntity>;
  } => {
    const known = tracks.filter(t => t.addedAt < cutoff);
    const knownIds = new Set<TrackId>(known.map(t => t.id));
    const built = buildRecommenderContext({
      tracks: known,
      features: features.filter(f => knownIds.has(f.trackId)),
      events: ctx.events.filter(e => e.startedAt < cutoff),
      now: cutoff,
    });
    return { ctx: built, tracks: built.tracks, features: built.features };
  };
};

/**
 * Without-replacement sampling over the tracks that existed at `cutoff`.
 * Deterministic per factory: the seed advances by call index, so consecutive
 * runs draw different background samples instead of repeating one draw, while
 * two factories over the same input still produce identical sequences.
 */
export const sampleCandidatesFactory = (ctx: RecommenderContext) => {
  const tracks = [...ctx.tracks.values()];
  let calls = 0;
  return (n: number, exclude: ReadonlySet<TrackId>, cutoff: number): CandidateInput[] => {
    const pool = tracks.filter(t => t.addedAt < cutoff && !exclude.has(t.id)).map(t => t.id);
    const rnd = makeLcg(SAMPLE_SEED + calls++);
    const take = Math.min(n, pool.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(rnd() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, take).map(id => ({ track: ctx.tracks.get(id)!, features: ctx.features.get(id) ?? null }));
  };
};
