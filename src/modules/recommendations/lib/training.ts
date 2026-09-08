import type { AudioFeaturesEntity, TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import type { CandidateInput, ComponentWeights, ScoringContext } from "./scoring";
import { COMPONENT_KEYS, computeBreakdowns, DEFAULT_WEIGHTS, ranksToVector } from "./scoring";
import type { Session, SessionEvent } from "./sessions";

export interface AutoplayRun {
  seed: SessionEvent;
  targets: SessionEvent[];
  startedAt: number;
}

/**
 * Runs are maximal series of consecutive `origin === "autoplay"` events in a
 * session, seeded by the nearest preceding `origin === "user"` event (a
 * skipped user event still counts). A run with no preceding user event is
 * dropped — there is nothing to score candidates against.
 */
export const extractAutoplayRuns = (sessions: readonly Session[]): AutoplayRun[] => {
  const runs: AutoplayRun[] = [];
  for (const session of sessions) {
    let lastUser: SessionEvent | null = null;
    let i = 0;
    while (i < session.length) {
      const e = session[i];
      if (e.origin === "user") {
        lastUser = e;
        i++;
        continue;
      }
      const targets: SessionEvent[] = [];
      while (i < session.length && session[i].origin === "autoplay") {
        targets.push(session[i]);
        i++;
      }
      if (lastUser) runs.push({ seed: lastUser, targets, startedAt: targets[0].startedAt });
    }
  }
  return runs;
};

export interface TrainingExample {
  x: number[];
  y: 0 | 1;
  at: number;
}

export const labelOf = (e: SessionEvent, earlySkipSeconds: number): 0 | 1 | null => {
  if (e.completed) return 1;
  if (e.skipped) return e.secondsListened < earlySkipSeconds ? 0 : null;
  return null;
};

export interface BuildExamplesInput {
  runs: readonly AutoplayRun[];
  buildContextAt: (cutoff: number) => {
    ctx: ScoringContext;
    tracks: Map<TrackId, TrackEntity>;
    features: Map<TrackId, AudioFeaturesEntity>;
  };
  sampleCandidates: (n: number, exclude: ReadonlySet<TrackId>) => CandidateInput[];
  candidateSample?: number;
  chunkSize?: number;
  earlySkipSeconds?: number;
}

export const buildExamples = (input: BuildExamplesInput): TrainingExample[] => {
  const {
    runs,
    buildContextAt,
    sampleCandidates,
    candidateSample = 300,
    chunkSize = 20,
    earlySkipSeconds = 30,
  } = input;

  const sorted = [...runs].sort((a, b) => a.startedAt - b.startedAt);
  const examples: TrainingExample[] = [];

  for (let start = 0; start < sorted.length; start += chunkSize) {
    const chunk = sorted.slice(start, start + chunkSize);
    const { ctx, tracks, features } = buildContextAt(chunk[0].startedAt);

    for (const run of chunk) {
      const seedTrack = tracks.get(run.seed.trackId);
      if (!seedTrack) continue;

      const exclude = new Set<TrackId>([run.seed.trackId, ...run.targets.map(t => t.trackId)]);
      const presentTargets: { event: SessionEvent; candidate: CandidateInput }[] = [];
      for (const t of run.targets) {
        const track = tracks.get(t.trackId);
        if (track) presentTargets.push({ event: t, candidate: { track, features: features.get(t.trackId) ?? null } });
      }
      const sampled = sampleCandidates(candidateSample, exclude);
      const candidates = [...presentTargets.map(pt => pt.candidate), ...sampled];

      const breakdowns = computeBreakdowns(ctx, { track: seedTrack, features: features.get(seedTrack.id) ?? null }, candidates);

      for (let i = 0; i < presentTargets.length; i++) {
        const y = labelOf(presentTargets[i].event, earlySkipSeconds);
        if (y === null) continue;
        examples.push({ x: ranksToVector(breakdowns[i].ranks), y, at: presentTargets[i].event.startedAt });
      }
    }
  }
  return examples;
};

export interface TrainOptions {
  l2: number;
  epochs: number;
  learningRate: number;
  minPositives: number;
  minNegatives: number;
}

export const DEFAULT_TRAIN_OPTIONS: TrainOptions = {
  l2: 0.01,
  epochs: 300,
  learningRate: 0.1,
  minPositives: 15,
  minNegatives: 15,
};

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/**
 * Full-batch gradient descent, bias term dropped from the returned weights.
 * Weights are projected to `>= 0` after every step and initialised to
 * DEFAULT_WEIGHTS as a sensible prior — deterministic, no randomness.
 */
export const trainWeights = (
  examples: readonly TrainingExample[],
  opts: TrainOptions = DEFAULT_TRAIN_OPTIONS,
): ComponentWeights | null => {
  const positives = examples.filter(e => e.y === 1).length;
  const negatives = examples.length - positives;
  if (positives < opts.minPositives || negatives < opts.minNegatives) return null;

  const k = COMPONENT_KEYS.length;
  const w = COMPONENT_KEYS.map(key => DEFAULT_WEIGHTS[key]);
  let bias = 0;
  const n = examples.length;

  for (let epoch = 0; epoch < opts.epochs; epoch++) {
    const gradW = new Array<number>(k).fill(0);
    let gradB = 0;
    for (const ex of examples) {
      let z = bias;
      for (let i = 0; i < k; i++) z += w[i] * ex.x[i];
      const err = sigmoid(z) - ex.y;
      for (let i = 0; i < k; i++) gradW[i] += err * ex.x[i];
      gradB += err;
    }
    for (let i = 0; i < k; i++) {
      w[i] -= opts.learningRate * (gradW[i] / n + opts.l2 * w[i]);
      if (w[i] < 0) w[i] = 0;
    }
    bias -= opts.learningRate * (gradB / n);
  }

  const sum = w.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || sum === 0) return null;

  const weights = {} as ComponentWeights;
  for (let i = 0; i < k; i++) weights[COMPONENT_KEYS[i]] = w[i] / sum;
  return weights;
};

export const blendWeights = (
  base: ComponentWeights,
  learned: ComponentWeights,
  examples: number,
  fullAt = 200,
): ComponentWeights => {
  const lambda = Math.min(1, examples / fullAt);
  const weights = {} as ComponentWeights;
  for (const key of COMPONENT_KEYS) weights[key] = base[key] * (1 - lambda) + learned[key] * lambda;
  return weights;
};

/** `x` is a `ranksToVector` output — component order matches `COMPONENT_KEYS`. */
export const dot = (x: readonly number[], w: ComponentWeights): number => {
  let s = 0;
  for (let i = 0; i < COMPONENT_KEYS.length; i++) s += x[i] * w[COMPONENT_KEYS[i]];
  return s;
};
