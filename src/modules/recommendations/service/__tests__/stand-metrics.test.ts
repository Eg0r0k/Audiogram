import { describe, it, expect } from "vitest";
import type { MmrOptions } from "@/modules/recommendations/lib/rank";
import type { Session, SessionEvent } from "@/modules/recommendations/lib/sessions";
import type { Breakdown, ComponentRanks, ComponentWeights } from "@/modules/recommendations/lib/scoring";
import { breakdownsToRankMatrix, COMPONENT_KEYS } from "@/modules/recommendations/lib/scoring";
import {
  hitRate,
  pairAgreement,
  sampleTransitions,
  type AgreementCase,
  type TransitionCase,
} from "@/modules/recommendations/service/stand-metrics";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;

const ZERO = Object.fromEntries(COMPONENT_KEYS.map(k => [k, 0])) as ComponentWeights;
const W: ComponentWeights = { ...ZERO, affinity: 1 };
const NO_MMR: MmrOptions = { artistPenalty: 0, albumPenalty: 0, maxPerArtist: 0 };

const bd = (ranks: Partial<ComponentRanks>, recencyPenalty = 0): Breakdown => ({
  audioSimilarity: null,
  trackTransition: 0,
  artistTransition: 0,
  affinity: 0,
  explore: 0,
  recencyPenalty,
  ranks: { ...ZERO, ...ranks },
});

const candidate = (i: number, artist?: string) => ({
  trackId: tid(`c${i}`),
  artistIds: [(artist ?? `a${i}`) as ArtistId],
  albumId: `al${i}` as AlbumId,
});

const transitionCase = (
  breakdowns: Breakdown[],
  targetRow: number,
  artists?: string[],
): TransitionCase => ({
  ranks: breakdownsToRankMatrix(breakdowns),
  candidates: breakdowns.map((_, i) => candidate(i, artists?.[i])),
  targetRow,
});

const affinityCase = (affinity: number[], targetRow: number, artists?: string[]): TransitionCase =>
  transitionCase(affinity.map(v => bd({ affinity: v })), targetRow, artists);

const event = (id: string): SessionEvent => ({
  trackId: tid(id),
  artistId: `ar-${id}` as ArtistId,
  startedAt: 0,
  skipped: false,
  completed: true,
  origin: "user",
  secondsListened: 100,
});
const session = (...ids: string[]): Session => ids.map(event);

describe("sampleTransitions", () => {
  const sessions = [session("A", "B", "C"), session("D", "E")];

  it("enumerates every transition when count is large", () => {
    const t = sampleTransitions(sessions, 100, 1);
    expect(t.length).toBe(3);
    expect(t[0].session[t[0].index].trackId).toBe(tid("A"));
  });

  it("is deterministic for a seed and differs across seeds", () => {
    const big = Array.from({ length: 50 }, (_, i) => session(`x${i}`, `y${i}`, `z${i}`));
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
      affinityCase([0.9, 0.1, 0.5], 2),
      affinityCase([0.9, 0.1, 0.5], 1),
      affinityCase([0.9, 0.1, 0.5], -1),
    ];
    expect(hitRate(cases, W, 2, NO_MMR)).toBeCloseTo(1 / 3, 6);
    expect(hitRate([], W, 2, NO_MMR)).toBe(0);
  });

  it("scores rows with scoreBreakdown, recency penalty included", () => {
    const withPenalty = transitionCase([bd({ affinity: 1 }, -0.5), bd({ affinity: 0.6 })], 0);
    const withoutPenalty = transitionCase([bd({ affinity: 1 }), bd({ affinity: 0.6 })], 0);
    expect(hitRate([withPenalty], W, 1, NO_MMR)).toBe(0);
    expect(hitRate([withoutPenalty], W, 1, NO_MMR)).toBe(1);
  });

  it("applies the MMR options", () => {
    const c = affinityCase([0.9, 0.8, 0.7], 2, ["x", "x", "y"]);
    expect(hitRate([c], W, 2, { ...NO_MMR, maxPerArtist: 1 })).toBe(1);
    expect(hitRate([c], W, 2, { ...NO_MMR, artistPenalty: 0.5 })).toBe(1);
    expect(hitRate([c], W, 2, NO_MMR)).toBe(0);
  });

  it("keeps the top-K prefilter exact for high-ranked targets", () => {
    const affinity = Array.from({ length: 100 }, (_, i) => 1 - i / 100);
    expect(hitRate([affinityCase(affinity, 2)], W, 3, NO_MMR)).toBe(1);
    expect(hitRate([affinityCase(affinity, 40)], W, 3, NO_MMR)).toBe(0);
  });

  it("prefilters to the top K, dropping a row exact MMR would have picked", () => {
    // limit 2 → K = 16. Only the last row has a free artist, and it scores
    // lowest, so the artist cap can reach it only while the pool fits in K.
    const cappedCase = (rows: number) => {
      const affinity = Array.from({ length: rows }, (_, i) => 1 - i / (rows * 2));
      affinity[rows - 1] = 0;
      const artists = Array.from({ length: rows }, () => "x");
      artists[rows - 1] = "y";
      return affinityCase(affinity, rows - 1, artists);
    };
    const mmr = { ...NO_MMR, maxPerArtist: 1 };
    expect(hitRate([cappedCase(10)], W, 2, mmr)).toBe(1);
    expect(hitRate([cappedCase(20)], W, 2, mmr)).toBe(0);
  });
});

describe("pairAgreement", () => {
  const agreementCase = (affinity: number[], likedRows: number[], dislikedRows: number[]): AgreementCase => ({
    ranks: breakdownsToRankMatrix(affinity.map(v => bd({ affinity: v }))),
    likedRows,
    dislikedRows,
  });

  it("is the share of liked-over-disliked pairs, averaged per source", () => {
    const cases = [
      agreementCase([0.9, 0.2, 0.5], [0, 2], [1]),
      agreementCase([0.1, 0.8], [0], [1]),
    ];
    expect(pairAgreement(cases, W)).toBeCloseTo((1 + 0) / 2, 6);
  });

  it("returns null without any two-sided source", () => {
    expect(pairAgreement([agreementCase([1], [0], [])], W)).toBeNull();
  });
});
