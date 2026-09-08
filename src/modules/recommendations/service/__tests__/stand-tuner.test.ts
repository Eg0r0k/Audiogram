import { describe, it, expect } from "vitest";
import type { MmrOptions } from "@/modules/recommendations/lib/rank";
import type { Breakdown, ComponentRanks } from "@/modules/recommendations/lib/scoring";
import { COMPONENT_KEYS } from "@/modules/recommendations/lib/scoring";
import type { AgreementCase, TransitionCase } from "@/modules/recommendations/service/stand-metrics";
import { createTuner, objective, ZERO_WEIGHTS } from "@/modules/recommendations/service/stand-tuner";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;
const NO_MMR: MmrOptions = { artistPenalty: 0, albumPenalty: 0, maxPerArtist: 0 };

const bd = (ranks: Partial<ComponentRanks>): Breakdown => ({
  audioSimilarity: null,
  trackTransition: ranks.trackTransition ?? 0,
  artistTransition: 0,
  affinity: ranks.affinity ?? 0,
  explore: 0,
  recencyPenalty: 0,
  ranks: { ...ZERO_WEIGHTS, ...ranks },
});

const ROWS = 20;

// Целевая строка — та, у которой максимальна affinity; trackTransition — шум.
const makeCase = (seed: number): TransitionCase => {
  const breakdowns: Breakdown[] = [];
  let best = 0;
  for (let r = 0; r < ROWS; r++) {
    const affinity = ((seed * 31 + r * 17) % 100) / 100;
    const trackTransition = ((seed * 7 + r * 13) % 100) / 100;
    breakdowns.push(bd({ affinity, trackTransition }));
    if (affinity > breakdowns[best].ranks.affinity) best = r;
  }
  return {
    breakdowns,
    candidates: breakdowns.map((_, i) => ({
      trackId: tid(`c${seed}-${i}`),
      artistIds: [`a${seed}-${i}` as ArtistId],
      albumId: `al${seed}-${i}` as AlbumId,
    })),
    targetRow: best,
  };
};

describe("createTuner", () => {
  const transitionCases = Array.from({ length: 30 }, (_, i) => makeCase(i + 1));
  const opts = {
    transitionCases,
    agreementCases: [],
    limit: 3,
    mmr: NO_MMR,
    randomSamples: 60,
    refineTop: 2,
    seed: 3,
  };

  it("finds weights that beat the zero start and favour affinity", () => {
    const tuner = createTuner(opts);
    expect(tuner.usesAgreement).toBe(false);
    while (!tuner.step(50)) { /* drain */ }
    expect(tuner.done).toBeGreaterThan(0);
    expect(tuner.best.objective).toBeGreaterThan(objective(ZERO_WEIGHTS, opts));
    expect(tuner.best.weights.affinity).toBeGreaterThan(tuner.best.weights.trackTransition);
    expect(tuner.best.objective).toBeGreaterThan(0.9);
  });

  it("keeps every weight inside [0, 1]", () => {
    const tuner = createTuner(opts);
    while (!tuner.step(50)) { /* drain */ }
    for (const key of COMPONENT_KEYS) {
      expect(tuner.best.weights[key]).toBeGreaterThanOrEqual(0);
      expect(tuner.best.weights[key]).toBeLessThanOrEqual(1);
    }
  });

  it("keeps frozen keys fixed", () => {
    const tuner = createTuner({ ...opts, frozen: { audio: 0.5 } });
    while (!tuner.step(50)) { /* drain */ }
    expect(tuner.best.weights.audio).toBe(0.5);
  });

  it("adds agreement to the objective from enough labeled pairs", () => {
    const agreementCase: AgreementCase = {
      breakdowns: Array.from({ length: 10 }, (_, i) => bd({ affinity: i / 10 })),
      likedRows: [5, 6, 7, 8, 9],
      dislikedRows: [0, 1, 2, 3, 4],
    };
    expect(createTuner({ ...opts, agreementCases: [agreementCase] }).usesAgreement).toBe(true);
    expect(createTuner({ ...opts, agreementCases: [agreementCase], minLabeledPairs: 26 }).usesAgreement).toBe(false);
  });

  it("honors randomSamples: 0", () => {
    const tuner = createTuner({ ...opts, randomSamples: 0 });
    const done = tuner.step(10);
    expect(done).toBe(true);
    expect(tuner.done).toBe(0);
    expect(tuner.best.weights).toEqual(ZERO_WEIGHTS);
  });
});
