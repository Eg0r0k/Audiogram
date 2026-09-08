import type { ListenEventEntity } from "@/db/entities";
import type { ComponentWeights } from "./scoring";

/** Fraction of (positive, negative) pairs where the positive scores higher; ties count 0.5. */
export const pairwiseAuc = (scored: readonly { score: number; y: 0 | 1 }[]): number | null => {
  const positives = scored.filter(s => s.y === 1);
  const negatives = scored.filter(s => s.y === 0);
  if (positives.length === 0 || negatives.length === 0) return null;

  let wins = 0;
  for (const p of positives) {
    for (const neg of negatives) {
      if (p.score > neg.score) wins += 1;
      else if (p.score === neg.score) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
};

export const splitByTime = <T extends { at: number }>(
  items: readonly T[],
  holdoutShare: number,
): { train: T[]; holdout: T[] } => {
  const sorted = [...items].sort((a, b) => a.at - b.at);
  const n = sorted.length;
  let holdoutCount = Math.round(n * holdoutShare);
  if (holdoutShare > 0 && n >= 2 && holdoutCount < 1) holdoutCount = 1;
  const splitIdx = n - holdoutCount;
  return { train: sorted.slice(0, splitIdx), holdout: sorted.slice(splitIdx) };
};

export interface EvalReport {
  examples: number;
  positives: number;
  negatives: number;
  aucDefault: number | null;
  aucLearned: number | null;
  weights: ComponentWeights | null;
  autoplaySkipRate14d: number | null;
  autoplayPlays14d: number;
}

export const autoplaySkipRate = (
  events: readonly ListenEventEntity[],
  sinceMs: number,
  earlySkipSeconds: number,
): { plays: number; rate: number | null } => {
  let plays = 0;
  let earlySkips = 0;
  for (const e of events) {
    if (e.origin !== "autoplay" || e.startedAt < sinceMs) continue;
    plays += 1;
    if (e.skipped && e.secondsListened < earlySkipSeconds) earlySkips += 1;
  }
  return { plays, rate: plays === 0 ? null : earlySkips / plays };
};
