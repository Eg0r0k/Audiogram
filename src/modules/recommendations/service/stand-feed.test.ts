import { describe, expect, it } from "vitest";
import type { TrackEntity } from "@/db/entities";
import type { QueueItem } from "@/modules/queue/types";
import type { QueueItemId, TrackId } from "@/types/ids";
import { DEFAULT_MMR_OPTIONS } from "../lib/rank";
import { DEFAULT_WEIGHTS, type Breakdown } from "../lib/scoring";
import { buildTransitions } from "../lib/transitions";
import { pairKey, type FeedbackEntry } from "./stand-feedback.store";
import { pickFeedBatch, splitFeed, type FeedContext, type FeedEntry } from "./stand-feed";

const tid = (s: string) => s as TrackId;

const makeTrack = (id: string, o: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid(id), title: `Track ${id}`, artistName: "Artist", albumTitle: "Album",
  artistIds: [`ar-${id}` as any], albumId: `al-${id}` as any, tagIds: [],
  source: "local_internal" as any, pinned: 1, state: 0, duration: 200, format: {},
  playCount: 0, addedAt: 0, ...o,
});

const makeCtx = (tracks: TrackEntity[]): FeedContext => ({
  now: 1_000_000,
  audioSpace: null,
  transitions: buildTransitions([]),
  affinity: new Map(),
  tracks: new Map(tracks.map(t => [t.id, t])),
  features: new Map(),
});

const breakdown: Breakdown = {
  audioSimilarity: null, trackTransition: 0, artistTransition: 0, affinity: 0, explore: 0, recencyPenalty: 0,
  ranks: { audio: 0, trackTransition: 0, artistTransition: 0, affinity: 0, explore: 0 },
};

const item = (id: string, kind: "library" | "remote" = "library"): QueueItem => ({
  id: `q-${id}` as QueueItemId,
  track: { kind, id: tid(id) } as any,
  source: { type: "autoplay" },
  addedAt: 0,
});

describe("pickFeedBatch", () => {
  const tracks = ["seed", "a", "b", "c", "d"].map(id => makeTrack(id));
  const ctx = makeCtx(tracks);

  it("never returns the seed or excluded tracks and honours the limit", () => {
    const picks = pickFeedBatch(ctx, tid("seed"), new Set([tid("a")]), DEFAULT_WEIGHTS, 2, DEFAULT_MMR_OPTIONS);
    expect(picks).toHaveLength(2);
    const ids = picks.map(p => p.track.id);
    expect(ids).not.toContain(tid("seed"));
    expect(ids).not.toContain(tid("a"));
  });

  it("returns fewer than limit when the pool is smaller", () => {
    const picks = pickFeedBatch(ctx, tid("seed"), new Set([tid("a"), tid("b"), tid("c")]), DEFAULT_WEIGHTS, 3, DEFAULT_MMR_OPTIONS);
    expect(picks.map(p => p.track.id)).toEqual([tid("d")]);
  });

  it("returns nothing when the seed is unknown", () => {
    expect(pickFeedBatch(ctx, tid("nope"), new Set(), DEFAULT_WEIGHTS, 3, DEFAULT_MMR_OPTIONS)).toEqual([]);
  });

  it("scores with the given weights: recently played tracks carry the penalty", () => {
    const recent = makeTrack("recent", { lastPlayedAt: 1_000_000 - 60_000 });
    const fresh = makeTrack("fresh");
    const picks = pickFeedBatch(makeCtx([makeTrack("seed"), recent, fresh]), tid("seed"), new Set(), DEFAULT_WEIGHTS, 2, DEFAULT_MMR_OPTIONS);
    expect(picks[0].track.id).toBe(tid("fresh"));
    expect(picks[1].breakdown.recencyPenalty).toBeLessThan(0);
    expect(picks[1].score).toBeLessThan(picks[0].score);
  });
});

describe("splitFeed", () => {
  const feed = new Map<TrackId, FeedEntry>([
    [tid("seed"), { track: makeTrack("seed"), sourceId: null, score: 0, breakdown: null }],
    [tid("a"), { track: makeTrack("a"), sourceId: tid("seed"), score: 0.5, breakdown }],
    [tid("b"), { track: makeTrack("b"), sourceId: tid("seed"), score: 0.4, breakdown }],
    [tid("c"), { track: makeTrack("c"), sourceId: tid("seed"), score: 0.3, breakdown }],
  ]);
  const queue = [item("seed"), item("a"), item("b"), item("c")];

  it("splits around the current index, past newest first", () => {
    const split = splitFeed(queue, 2, feed, new Map());
    expect(split.current?.trackId).toBe(tid("b"));
    expect(split.upcoming.map(r => r.trackId)).toEqual([tid("c")]);
    expect(split.past.map(r => r.trackId)).toEqual([tid("a"), tid("seed")]);
  });

  it("skips queue items that are not in the feed", () => {
    const split = splitFeed([item("seed"), item("x"), item("a"), item("stream", "remote")], 0, feed, new Map());
    expect(split.current?.trackId).toBe(tid("seed"));
    expect(split.upcoming.map(r => r.trackId)).toEqual([tid("a")]);
  });

  it("reports no current when the current item is foreign", () => {
    const split = splitFeed([item("seed"), item("x")], 1, feed, new Map());
    expect(split.current).toBeNull();
    expect(split.past.map(r => r.trackId)).toEqual([tid("seed")]);
  });

  it("attaches labels from feedback by (sourceId, trackId)", () => {
    const fb = new Map<string, FeedbackEntry>([
      [pairKey(tid("seed"), tid("a")), { sourceId: tid("seed"), candidateId: tid("a"), label: -1, at: 0 }],
    ]);
    const split = splitFeed(queue, 0, feed, fb);
    expect(split.upcoming[0].label).toBe(-1);
    expect(split.upcoming[1].label).toBeNull();
    expect(split.current?.label).toBeNull();
  });
});
