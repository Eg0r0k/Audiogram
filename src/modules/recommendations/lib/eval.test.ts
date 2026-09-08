import { describe, it, expect } from "vitest";
import type { ListenEventEntity } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";
import { pairwiseAuc, splitByTime, autoplaySkipRate } from "./eval";

const tid = (s: string) => s as TrackId;
const aid = (s: string) => s as ArtistId;

describe("pairwiseAuc", () => {
  it("returns 1 for perfect separation", () => {
    const scored = [
      { score: 0.9, y: 1 as const },
      { score: 0.8, y: 1 as const },
      { score: 0.2, y: 0 as const },
      { score: 0.1, y: 0 as const },
    ];
    expect(pairwiseAuc(scored)).toBe(1);
  });

  it("returns 0 for perfectly inverted separation", () => {
    const scored = [
      { score: 0.1, y: 1 as const },
      { score: 0.2, y: 1 as const },
      { score: 0.8, y: 0 as const },
      { score: 0.9, y: 0 as const },
    ];
    expect(pairwiseAuc(scored)).toBe(0);
  });

  it("returns null when only one class is present", () => {
    expect(pairwiseAuc([{ score: 0.5, y: 1 }, { score: 0.6, y: 1 }])).toBeNull();
    expect(pairwiseAuc([{ score: 0.5, y: 0 }])).toBeNull();
    expect(pairwiseAuc([])).toBeNull();
  });

  it("counts ties as 0.5", () => {
    const scored = [
      { score: 0.5, y: 1 as const },
      { score: 0.5, y: 0 as const },
    ];
    expect(pairwiseAuc(scored)).toBe(0.5);
  });
});

describe("splitByTime", () => {
  it("splits 10 items 0.2 into 8 train / 2 holdout, holdout being the latest", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ at: i }));
    const { train, holdout } = splitByTime(items, 0.2);
    expect(train).toHaveLength(8);
    expect(holdout).toHaveLength(2);
    expect(holdout.map(h => h.at)).toEqual([8, 9]);
    expect(train.map(t => t.at)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("sorts unsorted input by `at` before splitting", () => {
    const items = [{ at: 3 }, { at: 1 }, { at: 2 }];
    const { train, holdout } = splitByTime(items, 1 / 3);
    expect(train.map(t => t.at)).toEqual([1, 2]);
    expect(holdout.map(h => h.at)).toEqual([3]);
  });

  it("holds out at least 1 item when n >= 2 and share > 0", () => {
    const items = [{ at: 1 }, { at: 2 }];
    const { train, holdout } = splitByTime(items, 0.01);
    expect(holdout).toHaveLength(1);
    expect(train).toHaveLength(1);
  });

  it("holds out nothing when share is 0", () => {
    const items = [{ at: 1 }, { at: 2 }];
    const { train, holdout } = splitByTime(items, 0);
    expect(holdout).toHaveLength(0);
    expect(train).toHaveLength(2);
  });
});

describe("autoplaySkipRate", () => {
  const DAY = 86_400_000;
  const now = 14 * DAY + 1000;
  const sinceMs = now - 14 * DAY;

  const makeEvent = (
    id: string,
    startedAt: number,
    overrides: Partial<ListenEventEntity> = {},
  ): ListenEventEntity => ({
    id,
    trackId: tid(id),
    artistId: aid(`art-${id}`),
    albumId: "album-default" as any,
    startedAt,
    secondsListened: 180,
    trackDuration: 200,
    completed: true,
    skipped: false,
    origin: "autoplay",
    ...overrides,
  });

  it("computes rate 0.25 over 4 autoplay events with 1 early skip, ignoring user origin and events past 14 days", () => {
    const events = [
      makeEvent("a1", sinceMs + 1000, { completed: false, skipped: true, secondsListened: 5 }),
      makeEvent("a2", sinceMs + 2000, { completed: true }),
      makeEvent("a3", sinceMs + 3000, { completed: true }),
      makeEvent("a4", sinceMs + 4000, { completed: true }),
      makeEvent("u1", sinceMs + 5000, { origin: "user", completed: false, skipped: true, secondsListened: 1 }),
      makeEvent("old", sinceMs - 1000, { completed: false, skipped: true, secondsListened: 1 }),
    ];

    const result = autoplaySkipRate(events, sinceMs, 30);
    expect(result.plays).toBe(4);
    expect(result.rate).toBe(0.25);
  });

  it("returns rate null when there are no plays", () => {
    expect(autoplaySkipRate([], sinceMs, 30)).toEqual({ plays: 0, rate: null });
  });
});
