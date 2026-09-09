import { describe, expect, it } from "vitest";
import type { ListenEventEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { adaptiveExploreShare, exploreAllowedAfter, exploreStats } from "./explore-policy";

const ev = (startedAt: number, o: Partial<ListenEventEntity> = {}): ListenEventEntity => ({
  id: `e-${startedAt}`, trackId: "t" as TrackId, artistId: "ar" as any, albumId: "al" as any,
  startedAt, secondsListened: 180, trackDuration: 200, completed: true, skipped: false, origin: "autoplay", ...o,
});

const earlySkip = { completed: false, skipped: true, secondsListened: 5 };
const lateSkip = { completed: false, skipped: true, secondsListened: 90 };

describe("exploreAllowedAfter", () => {
  it("allows with no history", () => {
    expect(exploreAllowedAfter([])).toBe(true);
  });

  it("forbids right after an early skip, allows after a late skip or a completion", () => {
    expect(exploreAllowedAfter([ev(1), ev(2, earlySkip)])).toBe(false);
    expect(exploreAllowedAfter([ev(1, earlySkip), ev(2)])).toBe(true);
    expect(exploreAllowedAfter([ev(1), ev(2, lateSkip)])).toBe(true);
  });

  it("forbids right after an exploration pick", () => {
    expect(exploreAllowedAfter([ev(1), ev(2, { pick: "explore" })])).toBe(false);
    expect(exploreAllowedAfter([ev(1, { pick: "explore" }), ev(2, { pick: "rank" })])).toBe(true);
  });

  it("judges by startedAt, not array order", () => {
    expect(exploreAllowedAfter([ev(5, earlySkip), ev(1)])).toBe(false);
  });
});

describe("adaptiveExploreShare", () => {
  const explored = (outcomes: ("done" | "skip" | "late")[]) => outcomes.map((o, i) =>
    ev(1000 + i, { pick: "explore", ...(o === "skip" ? earlySkip : o === "late" ? lateSkip : {}) }));

  it("keeps the base share with fewer than 10 labelled exploration events", () => {
    expect(adaptiveExploreShare(explored(["done", "done", "done", "skip"]), 1 / 3)).toBeCloseTo(1 / 3);
    expect(adaptiveExploreShare(explored(Array(9).fill("done")), 1 / 3)).toBeCloseTo(1 / 3);
  });

  it("ignores late skips and unlabelled events when counting", () => {
    const events = explored([...Array(9).fill("done"), ...Array(5).fill("late")]);
    expect(adaptiveExploreShare(events, 1 / 3)).toBeCloseTo(1 / 3);
  });

  it("doubles up to 2/3 when at least half get finished", () => {
    expect(adaptiveExploreShare(explored([...Array(8).fill("done"), ...Array(2).fill("skip")]), 1 / 3)).toBeCloseTo(2 / 3);
    expect(adaptiveExploreShare(explored([...Array(5).fill("done"), ...Array(5).fill("skip")]), 0.2)).toBeCloseTo(0.4);
  });

  it("halves when fewer than a quarter get finished", () => {
    expect(adaptiveExploreShare(explored([...Array(2).fill("done"), ...Array(8).fill("skip")]), 1 / 3)).toBeCloseTo(1 / 6);
  });

  it("keeps the base in between", () => {
    expect(adaptiveExploreShare(explored([...Array(4).fill("done"), ...Array(6).fill("skip")]), 1 / 3)).toBeCloseTo(1 / 3);
  });

  it("looks only at the most recent window of exploration events", () => {
    const old = Array.from({ length: 30 }, (_, i) => ev(i, { pick: "explore", ...earlySkip }));
    const recent = Array.from({ length: 30 }, (_, i) => ev(1000 + i, { pick: "explore" }));
    expect(adaptiveExploreShare([...old, ...recent], 1 / 3)).toBeCloseTo(2 / 3);
  });

  it("ignores ranked picks entirely", () => {
    const ranked = Array.from({ length: 30 }, (_, i) => ev(i, { pick: "rank", ...earlySkip }));
    expect(adaptiveExploreShare(ranked, 1 / 3)).toBeCloseTo(1 / 3);
  });
});

describe("exploreStats", () => {
  it("splits autoplay outcomes by pick, counting untagged as ranked, inside the window", () => {
    const events = [
      ev(10, { pick: "explore" }),
      ev(11, { pick: "explore", ...earlySkip }),
      ev(12, { pick: "explore", ...lateSkip }),
      ev(13, { pick: "rank" }),
      ev(14),
      ev(15, { origin: "user" }),
      ev(1, { pick: "explore" }),
    ];
    expect(exploreStats(events, 5)).toEqual({
      explore: { plays: 3, completed: 1, earlySkips: 1 },
      rank: { plays: 2, completed: 2, earlySkips: 0 },
    });
  });
});
