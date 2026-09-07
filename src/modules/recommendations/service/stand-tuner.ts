import { SIGNAL_KEYS, type SignalKey, type Weights } from "./signals";
import { hitRate, makeLcg, pairAgreement, type AgreementCase, type TransitionCase } from "./stand-metrics";

export interface TunerOptions {
  transitionCases: TransitionCase[];
  agreementCases: AgreementCase[];
  limit: number;
  maxPerArtist: number;
  frozen?: Partial<Record<SignalKey, number>>;
  randomSamples?: number;
  refineTop?: number;
  step?: number;
  seed?: number;
  minLabeledPairs?: number;
}

export interface Tuner {
  readonly total: number;
  readonly done: number;
  readonly best: { weights: Weights; objective: number };
  readonly usesAgreement: boolean;
  step: (count: number) => boolean;
}

const MAX_REFINE_PASSES = 20;

const labeledPairs = (cases: AgreementCase[]): number =>
  cases.reduce((n, c) => n + c.likedRows.length * c.dislikedRows.length, 0);

const usesAgreementFor = (opts: TunerOptions): boolean =>
  labeledPairs(opts.agreementCases) >= (opts.minLabeledPairs ?? 20);

export const objective = (weights: Weights, opts: TunerOptions): number => {
  const hit = hitRate(opts.transitionCases, weights, opts.limit, opts.maxPerArtist);
  if (!usesAgreementFor(opts)) return hit;
  const agreement = pairAgreement(opts.agreementCases, weights);
  return agreement === null ? hit : 0.5 * agreement + 0.5 * hit;
};

export const createTuner = (opts: TunerOptions): Tuner => {
  const randomSamples = opts.randomSamples ?? 400;
  const refineTop = opts.refineTop ?? 5;
  const stepSize = opts.step ?? 0.05;
  const rnd = makeLcg(opts.seed ?? 1);
  const frozen = opts.frozen ?? {};
  const freeKeys = SIGNAL_KEYS.filter(k => !(k in frozen));
  const usesAgreement = usesAgreementFor(opts);

  const withFrozen = (w: Weights): Weights => ({ ...w, ...frozen });
  const evaluate = (w: Weights) => ({ weights: w, objective: objective(w, opts) });

  const candidates: { weights: Weights; objective: number }[] = [];
  const initialWeights = Object.fromEntries(SIGNAL_KEYS.map(k => [k, 0])) as Weights;
  let best = evaluate(withFrozen(initialWeights));
  let done = 0;
  let phase: "random" | "refine" | "done" = "random";
  let refineIndex = 0;
  let current: { weights: Weights; objective: number } | null = null;
  let pass = 0;
  let improvedInPass = false;
  let keyIndex = 0;
  let direction = 1;

  const total = randomSamples + refineTop * MAX_REFINE_PASSES * freeKeys.length * 2;

  const consider = (c: { weights: Weights; objective: number }) => {
    if (c.objective > best.objective) best = c;
  };

  const randomStep = () => {
    if (candidates.length >= randomSamples) {
      candidates.sort((a, b) => b.objective - a.objective);
      phase = candidates.length > 0 ? "refine" : "done";
      current = candidates[0] ?? null;
      return;
    }
    const w = { ...best.weights };
    for (const k of freeKeys) w[k] = rnd() * 2 - 1;
    const c = evaluate(withFrozen(w));
    candidates.push(c);
    consider(c);
    done++;
  };

  const refineStep = () => {
    if (!current) {
      phase = "done";
      return;
    }
    const key = freeKeys[keyIndex];
    const w: Weights = { ...current.weights, [key]: Math.max(-1, Math.min(1, current.weights[key] + direction * stepSize)) };
    const c = evaluate(w);
    done++;
    if (c.objective > current.objective) {
      current = c;
      consider(c);
      improvedInPass = true;
    }
    if (direction === 1) {
      direction = -1;
      return;
    }
    direction = 1;
    keyIndex++;
    if (keyIndex < freeKeys.length) return;
    keyIndex = 0;
    pass++;
    if (improvedInPass && pass < MAX_REFINE_PASSES) {
      improvedInPass = false;
      return;
    }
    refineIndex++;
    pass = 0;
    improvedInPass = false;
    if (refineIndex >= Math.min(refineTop, candidates.length)) {
      phase = "done";
      return;
    }
    current = candidates[refineIndex];
  };

  return {
    get total() { return total; },
    get done() { return done; },
    get best() { return best; },
    usesAgreement,
    step: (count: number) => {
      for (let i = 0; i < count && phase !== "done"; i++) {
        if (phase === "random") randomStep();
        else refineStep();
      }
      return phase === "done";
    },
  };
};
