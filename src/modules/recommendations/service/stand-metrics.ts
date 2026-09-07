import type { SignalMatrix, Weights } from "./signals";
import { scoreMatrix, selectTopFast } from "./scoring";
import type { Session } from "./session-builder.service";

export interface Transition {
  session: Session;
  index: number;
}

export interface TransitionCase {
  matrix: SignalMatrix;
  targetRow: number;
}

export interface AgreementCase {
  matrix: SignalMatrix;
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

export const sampleTransitions = (sessions: Session[], count: number, seed: number): Transition[] => {
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

export const hitRate = (
  cases: TransitionCase[],
  weights: Weights,
  limit: number,
  maxPerArtist: number,
): number => {
  if (cases.length === 0) return 0;
  let hits = 0;
  for (const c of cases) {
    if (c.targetRow < 0) continue;
    const scores = scoreMatrix(c.matrix, weights);
    const top = selectTopFast(c.matrix, scores, limit, maxPerArtist);
    if (top.includes(c.targetRow)) hits++;
  }
  return hits / cases.length;
};

export const pairAgreement = (cases: AgreementCase[], weights: Weights): number | null => {
  let sum = 0;
  let sources = 0;
  for (const c of cases) {
    if (c.likedRows.length === 0 || c.dislikedRows.length === 0) continue;
    const scores = scoreMatrix(c.matrix, weights);
    let wins = 0;
    for (const l of c.likedRows) {
      for (const d of c.dislikedRows) if (scores[l] > scores[d]) wins++;
    }
    sum += wins / (c.likedRows.length * c.dislikedRows.length);
    sources++;
  }
  return sources === 0 ? null : sum / sources;
};
