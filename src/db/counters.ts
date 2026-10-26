import type { CounterEntity, CounterId, TrackEntity } from "./entities";

export type CountedTrack = Pick<TrackEntity, "likedAt" | "pinned" | "duration">;

export interface CounterDelta {
  count: number;
  seconds: number;
}

export type CounterDeltas = Record<CounterId, CounterDelta>;

export type Counters = Record<CounterId, CounterEntity>;

export type Tally = (before: CountedTrack | undefined, after: CountedTrack | undefined) => void;

const NO_DELTA: CounterDelta = { count: 0, seconds: 0 };

export const NO_COUNTER_DELTAS: CounterDeltas = { liked: NO_DELTA, members: NO_DELTA };

const COUNTED_FIELDS = ["likedAt", "pinned", "duration"] as const;

export const touchesCounters = (changes: object): boolean => COUNTED_FIELDS.some(field => field in changes);

const likedShare = (row: CountedTrack | undefined): CounterDelta =>
  row !== undefined && (row.likedAt ?? 0) > 0
    ? { count: 1, seconds: Number.isFinite(row.duration) ? row.duration : 0 }
    : NO_DELTA;

const memberShare = (row: CountedTrack | undefined): CounterDelta =>
  row?.pinned === 1 ? { count: 1, seconds: 0 } : NO_DELTA;

const minus = (a: CounterDelta, b: CounterDelta): CounterDelta => ({ count: a.count - b.count, seconds: a.seconds - b.seconds });

const plus = (a: CounterDelta, b: CounterDelta): CounterDelta => ({ count: a.count + b.count, seconds: a.seconds + b.seconds });

export const counterDeltas = (before: CountedTrack | undefined, after: CountedTrack | undefined): CounterDeltas => ({
  liked: minus(likedShare(after), likedShare(before)),
  members: minus(memberShare(after), memberShare(before)),
});

export const addCounterDeltas = (a: CounterDeltas, b: CounterDeltas): CounterDeltas => ({
  liked: plus(a.liked, b.liked),
  members: plus(a.members, b.members),
});

export const isNoDelta = (delta: CounterDelta): boolean => delta.count === 0 && delta.seconds === 0;

export const toCounters = (totals: CounterDeltas): Counters => ({
  liked: { id: "liked", ...totals.liked },
  members: { id: "members", ...totals.members },
});

// Dexie hands the mutation its own clone of the row, so the counted fields are copied first; false skips the row, as in Dexie.
export const tallying = <R extends CountedTrack>(tally: Tally, mutate: (row: R) => void | boolean) => (row: R): boolean => {
  const before: CountedTrack = { likedAt: row.likedAt, pinned: row.pinned, duration: row.duration };
  if (mutate(row) === false) return false;
  tally(before, row);
  return true;
};
