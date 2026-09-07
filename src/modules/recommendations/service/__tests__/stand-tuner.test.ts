import { describe, it, expect } from "vitest";
import { SIGNAL_KEYS, type SignalMatrix } from "@/modules/recommendations/service/signals";
import { createTuner, objective } from "@/modules/recommendations/service/stand-tuner";
import type { TrackId } from "@/types/ids";
import { ZERO_WEIGHTS } from "@/modules/recommendations/service/scoring";

const tid = (s: string) => s as TrackId;
const K = SIGNAL_KEYS.length;
const NOVELTY = SIGNAL_KEYS.indexOf("novelty");
const LIKED = SIGNAL_KEYS.indexOf("liked");

// Цель всегда та строка, у которой novelty максимальна, а liked — шум.
const makeCase = (seed: number) => {
  const rows = 20;
  const data = new Float32Array(rows * K);
  let best = 0;
  for (let r = 0; r < rows; r++) {
    const nov = ((seed * 31 + r * 17) % 100) / 100;
    data[r * K + NOVELTY] = nov;
    data[r * K + LIKED] = ((seed * 7 + r * 13) % 100) / 100;
    if (nov > data[best * K + NOVELTY]) best = r;
  }
  const matrix: SignalMatrix = {
    candidateIds: Array.from({ length: rows }, (_, i) => tid(`c${i}`)),
    artistKeys: Array.from({ length: rows }, (_, i) => `a${i}`),
    data,
  };
  return { matrix, targetRow: best };
};

describe("createTuner", () => {
  const transitionCases = Array.from({ length: 30 }, (_, i) => makeCase(i + 1));
  const opts = { transitionCases, agreementCases: [], limit: 3, maxPerArtist: 0, randomSamples: 60, refineTop: 2, seed: 3 };

  it("finds weights that beat the zero start and favour novelty", () => {
    const tuner = createTuner(opts);
    expect(tuner.usesAgreement).toBe(false);
    while (!tuner.step(50)) { /* drain */ }
    expect(tuner.done).toBeGreaterThan(0);
    expect(tuner.best.objective).toBeGreaterThan(objective(ZERO_WEIGHTS, opts));
    expect(tuner.best.weights.novelty).toBeGreaterThan(tuner.best.weights.liked);
    expect(tuner.best.objective).toBeGreaterThan(0.9);
  });

  it("keeps frozen keys fixed", () => {
    const tuner = createTuner({ ...opts, frozen: { audioSimilarity: 0 } });
    while (!tuner.step(50)) { /* drain */ }
    expect(tuner.best.weights.audioSimilarity).toBe(0);
  });
});
