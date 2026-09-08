import type { AlbumId, ArtistId, TrackId } from "@/types/ids";

export const percentileRanks = (values: readonly number[]): number[] => {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && order[j + 1].v === order[i].v) j++;
    const avg = (i + j) / 2;
    for (let k = i; k <= j; k++) ranks[order[k].i] = avg / (n - 1);
    i = j + 1;
  }
  return ranks;
};

export interface MmrCandidate {
  trackId: TrackId;
  artistIds: readonly ArtistId[];
  albumId: AlbumId;
  score: number;
}

export interface MmrOptions {
  artistPenalty: number;
  albumPenalty: number;
  maxPerArtist: number;
}

export const DEFAULT_MMR_OPTIONS: MmrOptions = {
  artistPenalty: 0.15,
  albumPenalty: 0.1,
  maxPerArtist: 2,
};

/**
 * Greedy diversification: each pick is the best remaining score minus a
 * penalty per already-picked track sharing an artist / album. The artist cap
 * is relaxed only when nothing else is left.
 */
export const mmrSelect = <T extends MmrCandidate>(
  candidates: readonly T[],
  limit: number,
  opts: MmrOptions = DEFAULT_MMR_OPTIONS,
): T[] => {
  const pool = [...candidates].sort((a, b) => b.score - a.score);
  const picked: T[] = [];
  const artistCount = new Map<ArtistId, number>();
  const albumCount = new Map<AlbumId, number>();

  const adjusted = (c: T) => {
    let s = c.score;
    for (const a of c.artistIds) s -= opts.artistPenalty * (artistCount.get(a) ?? 0);
    s -= opts.albumPenalty * (albumCount.get(c.albumId) ?? 0);
    return s;
  };
  const capped = (c: T) => opts.maxPerArtist > 0 && c.artistIds.some(a => (artistCount.get(a) ?? 0) >= opts.maxPerArtist);

  while (picked.length < limit && pool.length > 0) {
    let bestIdx = -1;
    let best = -Infinity;
    let bestUncappedIdx = -1;
    let bestUncapped = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const s = adjusted(pool[i]);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
      if (!capped(pool[i]) && s > bestUncapped) {
        bestUncapped = s;
        bestUncappedIdx = i;
      }
    }
    const idx = bestUncappedIdx >= 0 ? bestUncappedIdx : bestIdx;
    const [c] = pool.splice(idx, 1);
    picked.push(c);
    for (const a of c.artistIds) {
      artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
    }
    albumCount.set(c.albumId, (albumCount.get(c.albumId) ?? 0) + 1);
  }
  return picked;
};
