import { describe, it, expect } from "vitest";
import type { ListenEventEntity } from "@/db/entities";
import type { ArtistId, TrackId } from "@/types/ids";
import { eventWeight, buildAffinityMap, buildArtistAffinityMap, DEFAULT_AFFINITY_OPTIONS } from "./affinity";

const tid = (s: string) => s as TrackId;
const DAY = 86_400_000;

const makeEvent = (
  trackId: string,
  startedAt: number,
  o: Partial<ListenEventEntity> = {},
): ListenEventEntity => ({
  id: `${trackId}-${startedAt}`,
  trackId: tid(trackId),
  artistId: `ar-${trackId}` as any,
  albumId: "al" as any,
  startedAt,
  secondsListened: 180,
  trackDuration: 200,
  completed: true,
  skipped: false,
  origin: "user",
  ...o,
});

describe("eventWeight", () => {
  const opts = { earlySkipSeconds: 30 };

  it("returns 1 for completed events", () => {
    const e = makeEvent("t1", 0, { completed: true, skipped: false });
    expect(eventWeight(e, opts)).toBe(1);
  });

  it("returns -1 for early skips (before earlySkipSeconds)", () => {
    const e = makeEvent("t1", 0, { completed: false, skipped: true, secondsListened: 10 });
    expect(eventWeight(e, opts)).toBe(-1);
  });

  it("returns -0.3 for late skips (after earlySkipSeconds)", () => {
    const e = makeEvent("t1", 0, { completed: false, skipped: true, secondsListened: 60 });
    expect(eventWeight(e, opts)).toBe(-0.3);
  });

  it("calculates partial progress for incomplete unskipped events", () => {
    const e = makeEvent("t1", 0, { completed: false, skipped: false, secondsListened: 120, trackDuration: 200 });
    expect(eventWeight(e, opts)).toBeCloseTo(0.1, 5);
  });

  it("returns 0 for events with zero or negative trackDuration", () => {
    const e = makeEvent("t1", 0, { completed: false, skipped: false, trackDuration: 0 });
    expect(eventWeight(e, opts)).toBe(0);
  });
});

describe("buildAffinityMap", () => {
  const now = Date.now();

  it("includes track with single completed event with score ≈ 1/3, evidence ≈ 1, plays = 1", () => {
    const events = [makeEvent("t1", now, { completed: true })];
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const map = buildAffinityMap(events, new Set(), opts);

    expect(map.has(tid("t1"))).toBe(true);
    const entry = map.get(tid("t1"))!;
    expect(entry.score).toBeCloseTo(1 / 3, 5);
    expect(entry.evidence).toBeCloseTo(1, 5);
    expect(entry.plays).toBe(1);
    expect(entry.skips).toBe(0);
  });

  it("includes track with three early skips with score ≈ -3/5, skips = 3", () => {
    const events = [
      makeEvent("t1", now, { completed: false, skipped: true, secondsListened: 10 }),
      makeEvent("t1", now - 1000, { completed: false, skipped: true, secondsListened: 10 }),
      makeEvent("t1", now - 2000, { completed: false, skipped: true, secondsListened: 10 }),
    ];
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const map = buildAffinityMap(events, new Set(), opts);

    expect(map.has(tid("t1"))).toBe(true);
    const entry = map.get(tid("t1"))!;
    expect(entry.score).toBeCloseTo(-3 / 5, 5);
    expect(entry.skips).toBe(3);
  });

  it("decays event weight by e^-1 at 60 day horizon", () => {
    const oldEvent = makeEvent("t1", now - 60 * DAY, { completed: true });
    const newEvent = makeEvent("t2", now, { completed: true });
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const map = buildAffinityMap([oldEvent, newEvent], new Set(), opts);

    const oldEntry = map.get(tid("t1"))!;
    const newEntry = map.get(tid("t2"))!;
    expect(oldEntry.evidence).toBeCloseTo(Math.exp(-1), 3);
    expect(newEntry.evidence).toBeCloseTo(1, 5);
  });

  it("includes liked track without listens with score = 1.5/3, plays = 0", () => {
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const map = buildAffinityMap([], new Set([tid("t1")]), opts);

    expect(map.has(tid("t1"))).toBe(true);
    const entry = map.get(tid("t1"))!;
    expect(entry.score).toBeCloseTo(1.5 / 3, 5);
    expect(entry.plays).toBe(0);
    expect(entry.skips).toBe(0);
  });

  it("combines like and completed event with score = 2.5/4", () => {
    const events = [makeEvent("t1", now, { completed: true })];
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const map = buildAffinityMap(events, new Set([tid("t1")]), opts);

    expect(map.has(tid("t1"))).toBe(true);
    const entry = map.get(tid("t1"))!;
    expect(entry.score).toBeCloseTo(2.5 / 4, 5);
  });

  it("excludes track without any events or likes", () => {
    const events = [makeEvent("t1", now, { completed: true })];
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const map = buildAffinityMap(events, new Set(), opts);

    expect(map.has(tid("t2"))).toBe(false);
  });
});

describe("buildArtistAffinityMap", () => {
  const now = Date.now();
  const aid = (s: string) => s as ArtistId;

  it("aggregates events by artist with the artist prior", () => {
    const events = [
      makeEvent("t1", now, { artistId: aid("ar-x"), completed: true }),
      makeEvent("t2", now, { artistId: aid("ar-x"), completed: true }),
    ];
    const map = buildArtistAffinityMap(events, [], { now, ...DEFAULT_AFFINITY_OPTIONS });
    const entry = map.get(aid("ar-x"))!;
    expect(entry.score).toBeCloseTo(2 / (2 + DEFAULT_AFFINITY_OPTIONS.artistPrior), 5);
    expect(entry.plays).toBe(2);
  });

  it("adds a liked weight per liked track of the artist", () => {
    const map = buildArtistAffinityMap([], [aid("ar-x"), aid("ar-x")], { now, ...DEFAULT_AFFINITY_OPTIONS });
    const entry = map.get(aid("ar-x"))!;
    expect(entry.score).toBeCloseTo(3 / (2 + DEFAULT_AFFINITY_OPTIONS.artistPrior), 5);
    expect(entry.evidence).toBeCloseTo(2, 5);
  });
});

describe("buildAffinityMap with artist shrinkage", () => {
  const now = Date.now();
  const aid = (s: string) => s as ArtistId;

  it("shrinks a thin track history toward its artist mean instead of zero", () => {
    const events = [makeEvent("t1", now, { artistId: aid("ar-x"), completed: false, skipped: true, secondsListened: 5 })];
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const artist = new Map([[aid("ar-x"), { score: 0.6, evidence: 10, plays: 10, skips: 0 }]]);

    const without = buildAffinityMap(events, new Set(), opts).get(tid("t1"))!;
    const withArtist = buildAffinityMap(events, new Set(), opts, artist).get(tid("t1"))!;

    expect(without.score).toBeCloseTo(-1 / 3, 5);
    expect(withArtist.score).toBeCloseTo((-1 + 2 * 0.6) / 3, 5);
  });

  it("leaves tracks of unknown artists shrinking to zero", () => {
    const events = [makeEvent("t1", now, { artistId: aid("ar-y"), completed: true })];
    const opts = { now, ...DEFAULT_AFFINITY_OPTIONS };
    const artist = new Map([[aid("ar-x"), { score: 0.6, evidence: 10, plays: 10, skips: 0 }]]);
    expect(buildAffinityMap(events, new Set(), opts, artist).get(tid("t1"))!.score).toBeCloseTo(1 / 3, 5);
  });
});
