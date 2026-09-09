import { DEFAULT_AFFINITY_OPTIONS } from "../lib/affinity";
import { autoplaySkipRate, pairwiseAuc, splitByTime, type EvalReport } from "../lib/eval";
import { exploreStats } from "../lib/explore-policy";
import { buildExamples, dot, extractAutoplayRuns, trainWeights } from "../lib/training";
import { DEFAULT_WEIGHTS } from "../lib/scoring";
import { getRecommenderContext } from "./recommender-context.service";
import { buildContextAtFactory, sampleCandidatesFactory } from "./recommender-training-context";

const HOLDOUT_SHARE = 0.2;
const SKIP_RATE_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export const runRecommenderEval = async (): Promise<EvalReport> => {
  const ctx = await getRecommenderContext();
  const runs = extractAutoplayRuns(ctx.sessions);
  const examples = buildExamples({
    runs,
    buildContextAt: buildContextAtFactory(ctx),
    sampleCandidates: sampleCandidatesFactory(ctx),
  });

  const { train, holdout } = splitByTime(examples, HOLDOUT_SHARE);
  const weights = trainWeights(train);

  const aucDefault = pairwiseAuc(holdout.map(e => ({ score: dot(e.x, DEFAULT_WEIGHTS), y: e.y })));
  const aucLearned = weights ? pairwiseAuc(holdout.map(e => ({ score: dot(e.x, weights), y: e.y }))) : null;

  const positives = examples.filter(e => e.y === 1).length;
  const negatives = examples.length - positives;
  const since = Date.now() - SKIP_RATE_WINDOW_DAYS * DAY_MS;
  const { plays, rate } = autoplaySkipRate(ctx.events, since, DEFAULT_AFFINITY_OPTIONS.earlySkipSeconds);
  const picks14d = exploreStats(ctx.events, since, DEFAULT_AFFINITY_OPTIONS.earlySkipSeconds);

  return {
    examples: examples.length,
    positives,
    negatives,
    aucDefault,
    aucLearned,
    weights,
    autoplaySkipRate14d: rate,
    autoplayPlays14d: plays,
    picks14d,
  };
};
