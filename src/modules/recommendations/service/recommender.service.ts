import { audioFeaturesRepository } from "@/db/repositories/audioFeatures.repository";
import type { TrackId } from "@/types/ids";
import { buildRecommendationContext, type RecommendationContext } from "./recommendation-context";
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS, scoreMatrix, selectTop, toScoredTracks, type ScoredTrack, type ScoringParams } from "./scoring";
import { collectSignalMatrix, toVector, type AudioLookup, type Weights } from "./signals";

export { toVector };
export type { ScoredTrack };

export interface RecommendOptions {
  weights?: Weights;
  params?: Partial<ScoringParams>;
  ctx?: RecommendationContext;
}

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

export const loadAudioLookup = async (
  sourceId: TrackId,
  candidateIds: TrackId[],
): Promise<AudioLookup> => {
  const [sourceResult, candidatesResult] = await Promise.all([
    audioFeaturesRepository.findById(sourceId),
    audioFeaturesRepository.findManyByIds(candidateIds),
  ]);
  const source = sourceResult.isOk() && sourceResult.value ? toVector(sourceResult.value) : null;
  const byId = new Map(
    (candidatesResult.isOk() ? candidatesResult.value : []).map(f => [f.trackId, toVector(f)]),
  );
  return { source, byId };
};

export const getRecommendations = async (
  sourceTrackId: TrackId,
  limit = 8,
  additionalExcludeIds: TrackId[] = [],
  options: RecommendOptions = {},
): Promise<ScoredTrack[]> => {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const params: ScoringParams = { ...DEFAULT_PARAMS, ...options.params, limit };
  const ctx = options.ctx ?? await buildRecommendationContext();
  if (ctx.tracks.size === 0) return [];

  const candidateIds = candidateIdsFor(sourceTrackId, ctx, params.recentWindow, additionalExcludeIds);
  if (candidateIds.length === 0) return [];

  const audio = weights.audioSimilarity !== 0
    ? await loadAudioLookup(sourceTrackId, candidateIds)
    : undefined;

  const matrix = collectSignalMatrix(sourceTrackId, candidateIds, ctx, { audio });
  const scores = scoreMatrix(matrix, weights);
  const rows = selectTop(matrix, scores, params.limit, params.maxPerArtist);
  return toScoredTracks(matrix, scores, rows, ctx.tracks);
};
