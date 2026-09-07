import { describe, it, expect } from "vitest";
import { SIGNAL_KEYS, type SignalMatrix, type Weights } from "@/modules/recommendations/service/signals";
import { ZERO_WEIGHTS } from "@/modules/recommendations/service/scoring";
import { hitRate, pairAgreement, sampleTransitions } from "@/modules/recommendations/service/stand-metrics";
import type { TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;
const K = SIGNAL_KEYS.length;
const LIKED = SIGNAL_KEYS.indexOf("liked");

const matrix = (liked: number[], artists?: string[]): SignalMatrix => {
  const data = new Float32Array(liked.length * K);
  liked.forEach((v, i) => { data[i * K + LIKED] = v; });
  return {
    candidateIds: liked.map((_, i) => tid(`c${i}`)),
    artistKeys: artists ?? liked.map((_, i) => `a${i}`),
    data,
  };
};
const w: Weights = { ...ZERO_WEIGHTS, liked: 1 };

describe("sampleTransitions", () => {
  const sessions = [[tid("A"), tid("B"), tid("C")], [tid("D"), tid("E")]];

  it("enumerates every transition when count is large", () => {
    const t = sampleTransitions(sessions, 100, 1);
    expect(t.length).toBe(3);
  });

  it("is deterministic for a seed and differs across seeds", () => {
    const big = Array.from({ length: 50 }, (_, i) => [tid(`x${i}`), tid(`y${i}`), tid(`z${i}`)]);
    const a = sampleTransitions(big, 10, 42);
    const b = sampleTransitions(big, 10, 42);
    const c = sampleTransitions(big, 10, 7);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(10);
  });
});

describe("hitRate", () => {
  it("counts targets inside the top-N", () => {
    const cases = [
      { matrix: matrix([0.9, 0.1, 0.5]), targetRow: 2 },
      { matrix: matrix([0.9, 0.1, 0.5]), targetRow: 1 },
      { matrix: matrix([0.9, 0.1, 0.5]), targetRow: -1 },
    ];
    expect(hitRate(cases, w, 2, 0)).toBeCloseTo(1 / 3, 6);
    expect(hitRate([], w, 2, 0)).toBe(0);
  });

  it("applies the artist cap", () => {
    const m = matrix([0.9, 0.8, 0.7], ["x", "x", "y"]);
    expect(hitRate([{ matrix: m, targetRow: 2 }], w, 2, 1)).toBe(1);
    expect(hitRate([{ matrix: m, targetRow: 2 }], w, 2, 0)).toBe(0);
  });
});

describe("pairAgreement", () => {
  it("is the share of liked-over-disliked pairs, averaged per source", () => {
    const cases = [
      { matrix: matrix([0.9, 0.2, 0.5]), likedRows: [0, 2], dislikedRows: [1] },
      { matrix: matrix([0.1, 0.8]), likedRows: [0], dislikedRows: [1] },
    ];
    expect(pairAgreement(cases, w)).toBeCloseTo((1 + 0) / 2, 6);
  });

  it("returns null without any two-sided source", () => {
    expect(pairAgreement([{ matrix: matrix([1]), likedRows: [0], dislikedRows: [] }], w)).toBeNull();
  });
});
