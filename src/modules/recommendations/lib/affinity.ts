import type { ListenEventEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";

export interface AffinityOptions {
  now: number;
  /** e-fold horizon of an event's weight, ms. */
  decayMs: number;
  /** Pseudo-evidence pulling thin histories toward 0. */
  prior: number;
  /** A skip before this many seconds is a full negative; later skips are mild. */
  earlySkipSeconds: number;
  /** Weight of a like — one explicit, undecayed positive. */
  likedWeight: number;
}

export const DEFAULT_AFFINITY_OPTIONS: Omit<AffinityOptions, "now"> = {
  decayMs: 60 * 86_400_000,
  prior: 2,
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

export const eventWeight = (
  e: ListenEventEntity,
  opts: Pick<AffinityOptions, "earlySkipSeconds">,
): number => {
  if (e.completed) return 1;
  if (e.skipped) return e.secondsListened < opts.earlySkipSeconds ? -1 : -0.3;
  if (e.trackDuration <= 0) return 0;
  return Math.min(e.secondsListened / e.trackDuration, 1) - 0.5;
};

export const buildAffinityMap = (
  events: readonly ListenEventEntity[],
  likedIds: ReadonlySet<TrackId>,
  opts: AffinityOptions,
): Map<TrackId, AffinityEntry> => {
  const acc = new Map<TrackId, { sum: number; evidence: number; plays: number; skips: number }>();
  const bucket = (id: TrackId) => {
    let b = acc.get(id);
    if (!b) {
      b = { sum: 0, evidence: 0, plays: 0, skips: 0 };
      acc.set(id, b);
    }
    return b;
  };

  for (const e of events) {
    const decay = Math.exp(-Math.max(0, opts.now - e.startedAt) / opts.decayMs);
    const b = bucket(e.trackId);
    b.sum += eventWeight(e, opts) * decay;
    b.evidence += decay;
    if (e.skipped) b.skips += 1;
    else b.plays += 1;
  }
  for (const id of likedIds) {
    const b = bucket(id);
    b.sum += opts.likedWeight;
    b.evidence += 1;
  }

  const result = new Map<TrackId, AffinityEntry>();
  for (const [id, b] of acc) {
    result.set(id, {
      score: b.sum / (b.evidence + opts.prior),
      evidence: b.evidence,
      plays: b.plays,
      skips: b.skips,
    });
  }
  return result;
};
