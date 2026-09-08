import type { RecommenderModelEntity } from "@/db/entities";
import { recommenderModelRepository } from "@/db/repositories/recommenderModel.repository";
import { getLogger } from "@/lib/logger";
import { blendWeights, extractAutoplayRuns, buildExamples, trainWeights, type TrainingExample } from "../lib/training";
import { DEFAULT_WEIGHTS, type ComponentWeights } from "../lib/scoring";
import { getRecommenderContext, type RecommenderContext } from "./recommender-context.service";
import { buildContextAtFactory, sampleCandidatesFactory } from "./recommender-training-context";

const FRESH_MS = 24 * 3_600_000;
const RUN_CHUNK_SIZE = 20;

/** `undefined` = not loaded yet; `null` = loaded, no stored model. */
let cachedRow: RecommenderModelEntity | null | undefined;
let loadingRow: Promise<RecommenderModelEntity | null> | null = null;
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
    loadingRow = recommenderModelRepository.get()
      .then((result) => {
        if (result.isErr()) {
          getLogger().error(`[Recommendations] Reading the learned model failed: ${String(result.error)}`);
          // Not cached: a transient read failure should not stick as "no model" forever.
          return null;
        }
        cachedRow = result.value;
        return cachedRow;
      })
      .finally(() => {
        loadingRow = null;
      });
  }
  return loadingRow;
};

export const invalidateWeightsCache = (): void => {
  cachedRow = undefined;
};

export const getActiveWeights = async (): Promise<ComponentWeights> => {
  const row = await loadRow();
  if (!row) return DEFAULT_WEIGHTS;
  return blendWeights(DEFAULT_WEIGHTS, row.weights, row.examples);
};

const trainOnAllExamples = async (ctx: RecommenderContext): Promise<void> => {
  const runs = [...extractAutoplayRuns(ctx.sessions)].sort((a, b) => a.startedAt - b.startedAt);
  if (runs.length === 0) return;

  const buildContextAt = buildContextAtFactory(ctx);
  const sampleCandidates = sampleCandidatesFactory(ctx);
  const examples: TrainingExample[] = [];
  for (let start = 0; start < runs.length; start += RUN_CHUNK_SIZE) {
    const chunk = runs.slice(start, start + RUN_CHUNK_SIZE);
    examples.push(...buildExamples({ runs: chunk, buildContextAt, sampleCandidates }));
    if (start + RUN_CHUNK_SIZE < runs.length) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  const weights = trainWeights(examples);
  if (!weights) return;

  const positives = examples.filter(e => e.y === 1).length;
  const negatives = examples.length - positives;
  const putResult = await recommenderModelRepository.put({
    weights,
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
  const row = await loadRow();
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
