import type { RecommenderModelEntity } from "@/db/entities";
import { recommenderModelRepository } from "@/db/repositories/recommenderModel.repository";
import { getLogger } from "@/lib/logger";
import { pairwiseAuc, splitByTime } from "../lib/eval";
import { blendWeights, dot, extractAutoplayRuns, buildExamples, trainWeights, type TrainingExample } from "../lib/training";
import { DEFAULT_WEIGHTS, type ComponentWeights } from "../lib/scoring";
import { getRecommenderContext, type RecommenderContext } from "./recommender-context.service";
import { buildContextAtFactory, sampleCandidatesFactory } from "./recommender-training-context";

const FRESH_MS = 24 * 3_600_000;
const RUN_CHUNK_SIZE = 20;
/** Newest share of the examples the candidate weights must win on before they replace the defaults. */
const HOLDOUT_SHARE = 0.2;

/**
 * Retraining walks one full context rebuild per chunk on the main thread, so
 * the cost has to be bounded; the newest runs are kept because personalisation
 * should follow current taste, not a years-old library.
 */
export const MAX_TRAINING_RUNS = 300;

/**
 * Bumped whenever the meaning of a rank component changes (v2: explore no
 * longer needs audio features, affinity falls back to the artist). Weights
 * fitted on older semantics are ignored and retrained.
 */
export const MODEL_FEATURE_VERSION = 2;

/** `undefined` = not loaded yet; `null` = loaded, no stored model. */
let cachedRow: RecommenderModelEntity | null | undefined;
let loadingRow: Promise<RecommenderModelEntity | null> | null = null;
// Bumped by every cache invalidation. A read that started before the bump
// must not populate `cachedRow` — it would resurrect the row the wipe or the
// retrain just replaced.
let rowGeneration = 0;
let trainingPromise: Promise<void> | null = null;
/**
 * Throttles `ensureModelFresh` attempts regardless of the stored row — a
 * stale row whose retrain doesn't save (no runs, too few examples, a `put`
 * error) must not retrain again on every call within the same 24h window.
 */
let lastAttemptAt = 0;

const loadRow = async (): Promise<RecommenderModelEntity | null> => {
  if (cachedRow !== undefined) return cachedRow;
  if (!loadingRow) {
    const gen = rowGeneration;
    loadingRow = recommenderModelRepository.get()
      .then((result) => {
        if (result.isErr()) {
          getLogger().error(`[Recommendations] Reading the learned model failed: ${String(result.error)}`);
          // Not cached: a transient read failure should not stick as "no model" forever.
          return null;
        }
        if (gen === rowGeneration) cachedRow = result.value;
        return result.value;
      })
      .finally(() => {
        loadingRow = null;
      });
  }
  return loadingRow;
};

const loadCurrentRow = async (): Promise<RecommenderModelEntity | null> => {
  const row = await loadRow();
  return row && row.featureVersion === MODEL_FEATURE_VERSION ? row : null;
};

export const invalidateWeightsCache = (): void => {
  cachedRow = undefined;
  rowGeneration++;
};

/**
 * Drops the learned model itself, not just the cache: weights fitted on
 * history the user has just deleted must stop steering the recommender.
 */
export const clearModel = async (): Promise<void> => {
  const result = await recommenderModelRepository.clear();
  if (result.isErr()) {
    getLogger().error(`[Recommendations] Clearing the learned model failed: ${String(result.error)}`);
  }
  invalidateWeightsCache();
};

export const getActiveWeights = async (): Promise<ComponentWeights> => {
  const row = await loadCurrentRow();
  if (!row) return DEFAULT_WEIGHTS;
  return blendWeights(DEFAULT_WEIGHTS, row.weights, row.examples);
};

const trainOnAllExamples = async (ctx: RecommenderContext): Promise<void> => {
  const runs = [...extractAutoplayRuns(ctx.sessions)]
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-MAX_TRAINING_RUNS);
  if (runs.length === 0) return;

  const buildContextAt = buildContextAtFactory(ctx);
  const sampleCandidates = sampleCandidatesFactory(ctx);
  const examples: TrainingExample[] = [];
  for (let start = 0; start < runs.length; start += RUN_CHUNK_SIZE) {
    const chunk = runs.slice(start, start + RUN_CHUNK_SIZE);
    examples.push(...buildExamples({ runs: chunk, buildContextAt, sampleCandidates }));
    if (start + RUN_CHUNK_SIZE < runs.length) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  // The stand-tuned defaults are the prior; learned weights only replace
  // them when they rank the newest hold-out better. Otherwise a stale row
  // fitted on older data must stop steering the recommender too.
  const { train, holdout } = splitByTime(examples, HOLDOUT_SHARE);
  const candidate = trainWeights(train);
  if (!candidate) return;
  const aucDefault = pairwiseAuc(holdout.map(e => ({ score: dot(e.x, DEFAULT_WEIGHTS), y: e.y })));
  const aucLearned = pairwiseAuc(holdout.map(e => ({ score: dot(e.x, candidate), y: e.y })));
  if (aucDefault === null || aucLearned === null) return;
  if (aucLearned < aucDefault) {
    getLogger().info(`[Recommendations] Learned weights rejected: hold-out AUC ${aucLearned.toFixed(3)} < default ${aucDefault.toFixed(3)}`);
    await clearModel();
    return;
  }

  const weights = trainWeights(examples);
  if (!weights) return;

  const positives = examples.filter(e => e.y === 1).length;
  const negatives = examples.length - positives;
  const putResult = await recommenderModelRepository.put({
    weights,
    featureVersion: MODEL_FEATURE_VERSION,
    trainedAt: Date.now(),
    examples: examples.length,
    positives,
    negatives,
  });
  if (putResult.isErr()) {
    getLogger().error(`[Recommendations] Saving the learned model failed: ${String(putResult.error)}`);
    return;
  }
  invalidateWeightsCache();
};

const runEnsureModelFresh = async (): Promise<void> => {
  const row = await loadCurrentRow();
  const now = Date.now();
  if (row && now - row.trainedAt < FRESH_MS) return;
  if (now - lastAttemptAt < FRESH_MS) return;
  // Recorded before the attempt (including the context load) so a throw
  // still counts as an attempt and keeps the throttle honest.
  lastAttemptAt = now;
  const ctx = await getRecommenderContext();
  await trainOnAllExamples(ctx);
};

/** Never rejects — errors are logged and swallowed so callers can fire-and-forget. */
export const ensureModelFresh = async (): Promise<void> => {
  if (!trainingPromise) {
    trainingPromise = runEnsureModelFresh()
      .catch((error) => {
        getLogger().error(`[Recommendations] Retraining the model failed: ${String(error)}`);
      })
      .finally(() => {
        trainingPromise = null;
      });
  }
  return trainingPromise;
};
