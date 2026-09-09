import type { ListenEventEntity } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";

export interface AffinityOptions {
  now: number;
  /** e-fold horizon of an event's weight, ms. */
  decayMs: number;
  /** Pseudo-evidence pulling thin histories toward the artist mean (or 0). */
  prior: number;
  /** Pseudo-evidence for the artist-level score; larger because artists pool many tracks. */
  artistPrior: number;
  /** A skip before this many seconds is a full negative; later skips are mild. */
  earlySkipSeconds: number;
  /** Weight of a like — one explicit, undecayed positive. */
  likedWeight: number;
}

export const DEFAULT_AFFINITY_OPTIONS: Omit<AffinityOptions, "now"> = {
  decayMs: 60 * 86_400_000,
  prior: 2,
  artistPrior: 5,
  earlySkipSeconds: 30,
  likedWeight: 1.5,
};

export interface AffinityEntry {
  /** Roughly −1..1; 0 for "no idea". */
  score: number;
  /** Decayed sum of listens (+ likes) behind the score. */
  evidence: number;
  plays: number;
  skips: number;
}

interface Bucket {
  sum: number;
  evidence: number;
  plays: number;
  skips: number;
  artistId: ArtistId | null;
}

export const eventWeight = (
  e: ListenEventEntity,
  opts: Pick<AffinityOptions, "earlySkipSeconds">,
): number => {
  if (e.completed) return 1;
  if (e.skipped) return e.secondsListened < opts.earlySkipSeconds ? -1 : -0.3;
  if (e.trackDuration <= 0) return 0;
  return Math.min(e.secondsListened / e.trackDuration, 1) - 0.5;
};

const bucketOf = <K>(acc: Map<K, Bucket>, key: K): Bucket => {
  let b = acc.get(key);
  if (!b) {
    b = { sum: 0, evidence: 0, plays: 0, skips: 0, artistId: null };
    acc.set(key, b);
  }
  return b;
};

const accumulate = (b: Bucket, e: ListenEventEntity, opts: AffinityOptions) => {
  const decay = Math.exp(-Math.max(0, opts.now - e.startedAt) / opts.decayMs);
  b.sum += eventWeight(e, opts) * decay;
  b.evidence += decay;
  if (e.skipped) b.skips += 1;
  else b.plays += 1;
};

export const buildArtistAffinityMap = (
  events: readonly ListenEventEntity[],
  likedArtistIds: readonly ArtistId[],
  opts: AffinityOptions,
): Map<ArtistId, AffinityEntry> => {
  const acc = new Map<ArtistId, Bucket>();
  for (const e of events) accumulate(bucketOf(acc, e.artistId), e, opts);
  for (const id of likedArtistIds) {
    const b = bucketOf(acc, id);
    b.sum += opts.likedWeight;
    b.evidence += 1;
  }
  const result = new Map<ArtistId, AffinityEntry>();
  for (const [id, b] of acc) {
    result.set(id, {
      score: b.sum / (b.evidence + opts.artistPrior),
      evidence: b.evidence,
      plays: b.plays,
      skips: b.skips,
    });
  }
  return result;
};

/**
 * With an artist map a track's thin history shrinks toward its artist's
 * score rather than toward zero, so one skip of a loved artist's track does
 * not read as dislike.
 */
export const buildAffinityMap = (
  events: readonly ListenEventEntity[],
  likedIds: ReadonlySet<TrackId>,
  opts: AffinityOptions,
  artistAffinity?: ReadonlyMap<ArtistId, AffinityEntry>,
): Map<TrackId, AffinityEntry> => {
  const acc = new Map<TrackId, Bucket>();
  for (const e of events) {
    const b = bucketOf(acc, e.trackId);
    if (b.artistId === null) b.artistId = e.artistId;
    accumulate(b, e, opts);
  }
  for (const id of likedIds) {
    const b = bucketOf(acc, id);
    b.sum += opts.likedWeight;
    b.evidence += 1;
  }

  const result = new Map<TrackId, AffinityEntry>();
  for (const [id, b] of acc) {
    const artistMean = (b.artistId && artistAffinity?.get(b.artistId)?.score) || 0;
    result.set(id, {
      score: (b.sum + opts.prior * artistMean) / (b.evidence + opts.prior),
      evidence: b.evidence,
      plays: b.plays,
      skips: b.skips,
    });
  }
  return result;
};
