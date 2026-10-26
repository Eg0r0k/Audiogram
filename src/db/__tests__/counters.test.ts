import { describe, expect, it } from "vitest";
import { addCounterDeltas, counterDeltas, NO_COUNTER_DELTAS, type CountedTrack } from "../counters";

const row = (overrides: Partial<CountedTrack> = {}): CountedTrack => ({ pinned: 1, duration: 100, ...overrides });

describe("counterDeltas", () => {
  it("a new liked member adds one to both counters and its duration to the liked seconds", () => {
    expect(counterDeltas(undefined, row({ likedAt: 5 }))).toEqual({
      liked: { count: 1, seconds: 100 },
      members: { count: 1, seconds: 0 },
    });
  });

  it("a removed row takes back exactly what it counted", () => {
    expect(counterDeltas(row({ likedAt: 5, duration: 240 }), undefined)).toEqual({
      liked: { count: -1, seconds: -240 },
      members: { count: -1, seconds: 0 },
    });
    expect(counterDeltas(row({ pinned: 0 }), undefined)).toEqual(NO_COUNTER_DELTAS);
  });

  it("a like on a shadow row moves the liked counter only", () => {
    expect(counterDeltas(row({ pinned: 0 }), row({ pinned: 0, likedAt: 5 }))).toEqual({
      liked: { count: 1, seconds: 100 },
      members: { count: 0, seconds: 0 },
    });
  });

  it("a duration edit moves the liked seconds only while the row is liked", () => {
    expect(counterDeltas(row({ likedAt: 5 }), row({ likedAt: 5, duration: 130 }))).toEqual({
      liked: { count: 0, seconds: 30 },
      members: { count: 0, seconds: 0 },
    });
    expect(counterDeltas(row(), row({ duration: 130 }))).toEqual(NO_COUNTER_DELTAS);
    expect(counterDeltas(row({ likedAt: 5 }), row({ duration: 130 }))).toEqual({
      liked: { count: -1, seconds: -100 },
      members: { count: 0, seconds: 0 },
    });
  });

  it("only likedAt above zero is a like and only pinned 1 is a member", () => {
    expect(counterDeltas(undefined, row({ likedAt: 0, pinned: 0 }))).toEqual(NO_COUNTER_DELTAS);
    expect(counterDeltas(row({ pinned: 1 }), row({ pinned: 0 }))).toEqual({
      liked: { count: 0, seconds: 0 },
      members: { count: -1, seconds: 0 },
    });
  });

  it("a duration that is not a finite number counts as zero seconds", () => {
    expect(counterDeltas(undefined, row({ likedAt: 5, duration: Number.NaN })).liked).toEqual({ count: 1, seconds: 0 });
  });

  it("addCounterDeltas sums both counters", () => {
    const like = counterDeltas(undefined, row({ likedAt: 5 }));
    const shadowLike = counterDeltas(undefined, row({ likedAt: 5, pinned: 0, duration: 40 }));

    expect(addCounterDeltas(like, shadowLike)).toEqual({
      liked: { count: 2, seconds: 140 },
      members: { count: 1, seconds: 0 },
    });
  });
});
