import { mmrSelect, type MmrCandidate, type MmrOptions } from "../lib/rank";
import { scoreRankMatrix, type ComponentWeights } from "../lib/scoring";
import type { Session } from "../lib/sessions";

export interface Transition {
  session: Session;
  index: number;
}

/** MMR inputs without the score — the stand rescores every row on each weight change. */
export type StandCandidate = Omit<MmrCandidate, "score">;

/** Rows of `breakdownsToRankMatrix` — cases are rescored on every weight change. */
export interface TransitionCase {
  ranks: Float32Array;
  candidates: StandCandidate[];
  /** Row of the track actually played next, or −1 when it is not a candidate. */
  targetRow: number;
}

export interface AgreementCase {
  ranks: Float32Array;
  likedRows: number[];
  dislikedRows: number[];
}

export const makeLcg = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

export const sampleTransitions = (sessions: readonly Session[], count: number, seed: number): Transition[] => {
  const all: Transition[] = [];
  for (const session of sessions) {
    for (let i = 0; i + 1 < session.length; i++) all.push({ session, index: i });
  }
  if (all.length <= count) return all;
  const rnd = makeLcg(seed);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rnd() * (all.length - i));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
};

/** Indices of the k best scores, best first (insertion into a bounded list). */
const topRows = (scores: ArrayLike<number>, k: number): number[] => {
  if (k <= 0) return [];
  const top: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (top.length === k && s <= scores[top[k - 1]]) continue;
    let pos = top.length;
    while (pos > 0 && scores[top[pos - 1]] < s) pos--;
    top.splice(pos, 0, i);
    if (top.length > k) top.pop();
  }
  return top;
};

interface ScoredRow extends MmrCandidate { row: number }

const toScoredRows = (c: TransitionCase, scores: ArrayLike<number>, rows: readonly number[]): ScoredRow[] =>
  rows.map(row => ({ ...c.candidates[row], score: scores[row], row }));

/**
 * Diversified top-N over the pre-filtered head. Keeping only K = limit * 8 rows
 * before MMR is exact unless the diversity rules push a row from outside the
 * head into the picks — acceptable for the hit@N estimate, not for the list
 * the user sees.
 */
const selectRows = (
  c: TransitionCase,
  scores: ArrayLike<number>,
  limit: number,
  mmr: MmrOptions,
): number[] => {
  const k = Math.min(scores.length, limit * 8);
  return mmrSelect(toScoredRows(c, scores, topRows(scores, k)), limit, mmr).map(p => p.row);
};

export const hitRate = (
  cases: readonly TransitionCase[],
  weights: ComponentWeights,
  limit: number,
  mmr: MmrOptions,
): number => {
  if (cases.length === 0) return 0;
  let hits = 0;
  for (const c of cases) {
    if (c.targetRow < 0) continue;
    const scores = scoreRankMatrix(c.ranks, weights);
    if (selectRows(c, scores, limit, mmr).includes(c.targetRow)) hits++;
  }
  return hits / cases.length;
};

export const pairAgreement = (cases: readonly AgreementCase[], weights: ComponentWeights): number | null => {
  let sum = 0;
  let sources = 0;
  for (const c of cases) {
    if (c.likedRows.length === 0 || c.dislikedRows.length === 0) continue;
    const scores = scoreRankMatrix(c.ranks, weights);
    let wins = 0;
    for (const l of c.likedRows) {
      for (const d of c.dislikedRows) if (scores[l] > scores[d]) wins++;
    }
    sum += wins / (c.likedRows.length * c.dislikedRows.length);
    sources++;
  }
  return sources === 0 ? null : sum / sources;
};
