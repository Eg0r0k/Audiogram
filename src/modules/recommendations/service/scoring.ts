import type { TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { SIGNAL_KEYS, type SignalMatrix, type SignalVector, type Weights } from "./signals";

export interface ScoringParams {
  limit: number;
  recentWindow: number;
  maxPerArtist: number;
}

export const DEFAULT_PARAMS: ScoringParams = { limit: 8, recentWindow: 5, maxPerArtist: 2 };

export const ZERO_WEIGHTS: Weights = Object.fromEntries(SIGNAL_KEYS.map(k => [k, 0])) as Weights;

export const DEFAULT_WEIGHTS: Weights = {
  ...ZERO_WEIGHTS,
  coOccurrence: 0.375,
  completionRate: 0.275,
  recency: 0.125,
  liked: 0.225,
};

export interface ScoredTrack {
  trackId: TrackId;
  track: TrackEntity;
  score: number;
  breakdown: SignalVector;
}

const K = SIGNAL_KEYS.length;

export const scoreMatrix = (m: SignalMatrix, w: Weights): Float32Array => {
  const rows = m.candidateIds.length;
  const wv = SIGNAL_KEYS.map(k => w[k]);
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    const base = r * K;
    let s = 0;
    for (let i = 0; i < K; i++) s += m.data[base + i] * wv[i];
    out[r] = s;
  }
  return out;
};

const applyArtistCap = (
  m: SignalMatrix,
  ordered: ArrayLike<number>,
  limit: number,
  maxPerArtist: number,
): number[] => {
  const out: number[] = [];
  const perArtist = new Map<string, number>();
  for (let i = 0; i < ordered.length && out.length < limit; i++) {
    const row = ordered[i];
    if (maxPerArtist > 0) {
      const key = m.artistKeys[row];
      const n = perArtist.get(key) ?? 0;
      if (n >= maxPerArtist) continue;
      perArtist.set(key, n + 1);
    }
    out.push(row);
  }
  return out;
};

export const selectTop = (
  m: SignalMatrix,
  scores: Float32Array,
  limit: number,
  maxPerArtist: number,
): number[] => {
  const idx = new Uint32Array(scores.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  idx.sort((a, b) => scores[b] - scores[a] || a - b);
  return applyArtistCap(m, idx, limit, maxPerArtist);
};

/**
 * Keeps only the top K = limit * 8 rows before the artist cap. Exact unless
 * the cap drops more than 7 * limit rows from the head — acceptable for the
 * hit@N estimate, not for the list the user sees.
 */
export const selectTopFast = (
  m: SignalMatrix,
  scores: Float32Array,
  limit: number,
  maxPerArtist: number,
): number[] => {
  const k = Math.min(scores.length, limit * 8);
  const top: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (top.length === k && s <= scores[top[k - 1]]) continue;
    let pos = top.length;
    while (pos > 0 && scores[top[pos - 1]] < s) pos--;
    top.splice(pos, 0, i);
    if (top.length > k) top.pop();
  }
  return applyArtistCap(m, top, limit, maxPerArtist);
};

export const rowVector = (m: SignalMatrix, row: number): SignalVector => {
  const base = row * K;
  const v = {} as SignalVector;
  for (let i = 0; i < K; i++) v[SIGNAL_KEYS[i]] = m.data[base + i];
  return v;
};

export const toScoredTracks = (
  m: SignalMatrix,
  scores: Float32Array,
  rows: number[],
  tracks: Map<TrackId, TrackEntity>,
): ScoredTrack[] => {
  const out: ScoredTrack[] = [];
  for (const row of rows) {
    const trackId = m.candidateIds[row];
    const track = tracks.get(trackId);
    if (!track) continue;
    out.push({ trackId, track, score: scores[row], breakdown: rowVector(m, row) });
  }
  return out;
};
