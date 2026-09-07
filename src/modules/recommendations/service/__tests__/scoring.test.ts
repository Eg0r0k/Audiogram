import { describe, it, expect } from "vitest";
import { SIGNAL_KEYS, type SignalMatrix, type Weights } from "@/modules/recommendations/service/signals";
import { DEFAULT_WEIGHTS, ZERO_WEIGHTS, rowVector, scoreMatrix, selectTop, selectTopFast } from "@/modules/recommendations/service/scoring";
import type { TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;
const K = SIGNAL_KEYS.length;

const matrix = (rows: { id: string; artist: string; liked?: number; novelty?: number }[]): SignalMatrix => {
  const data = new Float32Array(rows.length * K);
  rows.forEach((r, i) => {
    data[i * K + SIGNAL_KEYS.indexOf("liked")] = r.liked ?? 0;
    data[i * K + SIGNAL_KEYS.indexOf("novelty")] = r.novelty ?? 0;
  });
  return { candidateIds: rows.map(r => tid(r.id)), artistKeys: rows.map(r => r.artist), data };
};

describe("scoreMatrix", () => {
  it("is the weighted sum, negative weights included", () => {
    const m = matrix([{ id: "A", artist: "x", liked: 1, novelty: 0.5 }]);
    const w: Weights = { ...ZERO_WEIGHTS, liked: 0.4, novelty: -0.2 };
    expect(scoreMatrix(m, w)[0]).toBeCloseTo(0.4 - 0.1, 5);
  });

  it("DEFAULT_WEIGHTS sum to 1 with audio at 0", () => {
    const sum = SIGNAL_KEYS.reduce((s, k) => s + DEFAULT_WEIGHTS[k], 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(DEFAULT_WEIGHTS.audioSimilarity).toBe(0);
  });
});

describe("selectTop", () => {
  const m = matrix([
    { id: "A", artist: "x", liked: 0.9 },
    { id: "B", artist: "x", liked: 0.8 },
    { id: "C", artist: "x", liked: 0.7 },
    { id: "D", artist: "y", liked: 0.6 },
    { id: "E", artist: "z", liked: 0.5 },
  ]);
  const scores = scoreMatrix(m, { ...ZERO_WEIGHTS, liked: 1 });

  it("orders by score and caps per artist", () => {
    expect(selectTop(m, scores, 3, 2)).toEqual([0, 1, 3]);
    expect(selectTop(m, scores, 3, 0)).toEqual([0, 1, 2]);
    expect(selectTop(m, scores, 10, 1)).toEqual([0, 3, 4]);
  });

  it("selectTopFast agrees with selectTop on small inputs", () => {
    expect(selectTopFast(m, scores, 3, 2)).toEqual(selectTop(m, scores, 3, 2));
    expect(selectTopFast(m, scores, 2, 0)).toEqual([0, 1]);
  });

  it("rowVector reads a row back by key", () => {
    expect(rowVector(m, 3).liked).toBeCloseTo(0.6, 5);
    expect(rowVector(m, 3).coOccurrence).toBe(0);
  });

  it("selectTopFast with partial selection (K-bound branch)", () => {
    const limit = 2;
    const k = limit * 8;
    const rowCount = 40;
    const rows = Array.from({ length: rowCount }, (_, i) => ({
      id: `T${i}`,
      artist: i < 4 ? "x" : `artist${i}`,
      liked: ((i * 37) % rowCount) / rowCount,
    }));
    const m = matrix(rows);
    const scores = scoreMatrix(m, { ...ZERO_WEIGHTS, liked: 1 });

    expect(selectTopFast(m, scores, limit, 1)).toEqual(selectTop(m, scores, limit, 1));
    expect(selectTopFast(m, scores, limit, 0)).toEqual(selectTop(m, scores, limit, 0));
  });
});
