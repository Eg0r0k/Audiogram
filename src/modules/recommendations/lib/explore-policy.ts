import type { ListenEventEntity, ListenPick } from "@/db/entities";

export interface ExplorePolicyOptions {
  earlySkipSeconds: number;
  /** Most recent exploration events the share is judged on. */
  window: number;
  /** Below this many labelled events the base share is kept. */
  minLabelled: number;
}

export const DEFAULT_EXPLORE_POLICY: ExplorePolicyOptions = {
  earlySkipSeconds: 30,
  window: 30,
  minLabelled: 10,
};

const isEarlySkip = (e: ListenEventEntity, earlySkipSeconds: number): boolean =>
  e.skipped && e.secondsListened < earlySkipSeconds;

/** 1 for a completed listen, 0 for an early skip, null when the outcome says nothing. */
const outcomeOf = (e: ListenEventEntity, earlySkipSeconds: number): 0 | 1 | null => {
  if (e.completed) return 1;
  if (isEarlySkip(e, earlySkipSeconds)) return 0;
  return null;
};

const latestEvent = (events: readonly ListenEventEntity[]): ListenEventEntity | null => {
  let latest: ListenEventEntity | null = null;
  for (const e of events) if (!latest || e.startedAt > latest.startedAt) latest = e;
  return latest;
};

/**
 * No exploration right after an early skip or after another exploration
 * pick: both are the moments a listener is most likely to leave.
 */
export const exploreAllowedAfter = (
  events: readonly ListenEventEntity[],
  earlySkipSeconds = DEFAULT_EXPLORE_POLICY.earlySkipSeconds,
): boolean => {
  const last = latestEvent(events);
  if (!last) return true;
  return last.pick !== "explore" && !isEarlySkip(last, earlySkipSeconds);
};

/**
 * Base share, doubled (capped at 2/3) while exploration picks get finished,
 * halved while they get skipped; unchanged until enough of them are labelled.
 */
export const adaptiveExploreShare = (
  events: readonly ListenEventEntity[],
  base: number,
  opts: ExplorePolicyOptions = DEFAULT_EXPLORE_POLICY,
): number => {
  const labelled: number[] = [];
  const explored = events
    .filter(e => e.pick === "explore")
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const e of explored) {
    const y = outcomeOf(e, opts.earlySkipSeconds);
    if (y !== null) labelled.push(y);
    if (labelled.length >= opts.window) break;
  }
  if (labelled.length < opts.minLabelled) return base;
  const rate = labelled.reduce((s, y) => s + y, 0) / labelled.length;
  if (rate >= 0.5) return Math.min(2 / 3, base * 2);
  if (rate < 0.25) return base / 2;
  return base;
};

export interface PickStats {
  plays: number;
  completed: number;
  earlySkips: number;
}

/** Autoplay outcomes since `sinceMs`, split by pick; an untagged autoplay event counts as ranked. */
export const exploreStats = (
  events: readonly ListenEventEntity[],
  sinceMs: number,
  earlySkipSeconds = DEFAULT_EXPLORE_POLICY.earlySkipSeconds,
): Record<ListenPick, PickStats> => {
  const out: Record<ListenPick, PickStats> = {
    rank: { plays: 0, completed: 0, earlySkips: 0 },
    explore: { plays: 0, completed: 0, earlySkips: 0 },
  };
  for (const e of events) {
    if (e.origin !== "autoplay" || e.startedAt < sinceMs) continue;
    const bucket = out[e.pick ?? "rank"];
    bucket.plays += 1;
    if (e.completed) bucket.completed += 1;
    else if (isEarlySkip(e, earlySkipSeconds)) bucket.earlySkips += 1;
  }
  return out;
};
