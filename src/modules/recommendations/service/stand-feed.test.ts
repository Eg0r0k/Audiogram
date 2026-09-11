import { describe, expect, it } from "vitest";
import type { TrackEntity } from "@/db/entities";
import type { QueueItem } from "@/modules/queue/types";
import type { ArtistId, QueueItemId, TrackId } from "@/types/ids";
import { DEFAULT_MMR_OPTIONS } from "../lib/rank";
import { DEFAULT_WEIGHTS, type Breakdown } from "../lib/scoring";
import { buildTransitions } from "../lib/transitions";
import { pairKey, type FeedbackEntry } from "./stand-feedback.store";
import { pickFeedBatch, splitFeed, type FeedBatchOptions, type FeedContext, type FeedEntry } from "./stand-feed";

const tid = (s: string) => s as TrackId;
const NOW = 1_000_000;

const makeTrack = (id: string, o: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid(id), title: `Track ${id}`, artistName: "Artist", albumTitle: "Album",
  artistIds: [`ar-${id}` as any], albumId: `al-${id}` as any, tagIds: [],
  source: "local_internal" as any, pinned: 1, state: 0, duration: 200, format: {},
  playCount: 0, addedAt: 0, ...o,
});

const makeCtx = (tracks: TrackEntity[], o: Partial<FeedContext> = {}): FeedContext => ({
  now: NOW,
  audioSpace: null,
  transitions: buildTransitions([]),
  affinity: new Map(),
  artistAffinity: new Map(),
  tracks: new Map(tracks.map(t => [t.id, t])),
  features: new Map(),
  ...o,
});

const noExplore: FeedBatchOptions = { limit: 3, exploreShare: 0, mmr: DEFAULT_MMR_OPTIONS, allowExplore: false, rng: () => 0 };

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
    const picks = pickFeedBatch(ctx, tid("seed"), new Set([tid("a")]), DEFAULT_WEIGHTS, { ...noExplore, limit: 2 });
    expect(picks).toHaveLength(2);
    const ids = picks.map(p => p.track.id);
    expect(ids).not.toContain(tid("seed"));
    expect(ids).not.toContain(tid("a"));
    expect(picks.every(p => p.pick === "rank")).toBe(true);
  });

  it("returns fewer than limit when the pool is smaller", () => {
    const picks = pickFeedBatch(ctx, tid("seed"), new Set([tid("a"), tid("b"), tid("c")]), DEFAULT_WEIGHTS, noExplore);
    expect(picks.map(p => p.track.id)).toEqual([tid("d")]);
  });

  it("returns nothing when the seed is unknown", () => {
    expect(pickFeedBatch(ctx, tid("nope"), new Set(), DEFAULT_WEIGHTS, noExplore)).toEqual([]);
  });

  it("scores with the given weights: recently played tracks carry the penalty", () => {
    const recent = makeTrack("recent", { lastPlayedAt: NOW - 60_000 });
    const fresh = makeTrack("fresh");
    const picks = pickFeedBatch(makeCtx([makeTrack("seed"), recent, fresh]), tid("seed"), new Set(), DEFAULT_WEIGHTS, { ...noExplore, limit: 2 });
    expect(picks[0].track.id).toBe(tid("fresh"));
    expect(picks[1].breakdown.recencyPenalty).toBeLessThan(0);
    expect(picks[1].score).toBeLessThan(picks[0].score);
  });

  it("puts a recently imported unplayed track into the exploration slot, tagged", () => {
    const played = ["p1", "p2", "p3"].map(id => makeTrack(id));
    const affinity = new Map(played.map(t => [t.id, { score: 0.5, evidence: 3, plays: 3, skips: 0 }]));
    const newcomer = makeTrack("new", { addedAt: NOW - 86_400_000 });
    const stale = makeTrack("stale", { addedAt: 0 });
    const c = makeCtx([makeTrack("seed"), ...played, newcomer, stale], { affinity });
    const picks = pickFeedBatch(c, tid("seed"), new Set(), DEFAULT_WEIGHTS, { ...noExplore, exploreShare: 1 / 3, allowExplore: true });
    expect(picks.map(p => p.pick)).toEqual(["rank", "explore", "rank"]);
    expect(picks[1].track.id).toBe(tid("new"));
  });

  it("stays ranked-only when exploration is not allowed", () => {
    const newcomer = makeTrack("new", { addedAt: NOW - 86_400_000, artistIds: ["ar-loved" as ArtistId] });
    const c = makeCtx([makeTrack("seed"), makeTrack("a"), makeTrack("b"), newcomer]);
    const picks = pickFeedBatch(c, tid("seed"), new Set(), DEFAULT_WEIGHTS, { ...noExplore, exploreShare: 1 / 3, allowExplore: false });
    expect(picks.every(p => p.pick === "rank")).toBe(true);
  });
});

describe("splitFeed", () => {
  const feed = new Map<TrackId, FeedEntry>([
    [tid("seed"), { track: makeTrack("seed"), sourceId: null, score: 0, breakdown: null, pick: "rank" }],
    [tid("a"), { track: makeTrack("a"), sourceId: tid("seed"), score: 0.5, breakdown, pick: "rank" }],
    [tid("b"), { track: makeTrack("b"), sourceId: tid("seed"), score: 0.4, breakdown, pick: "explore" }],
    [tid("c"), { track: makeTrack("c"), sourceId: tid("seed"), score: 0.3, breakdown, pick: "rank" }],
  ]);
  const queue = [item("seed"), item("a"), item("b"), item("c")];

  it("splits around the current index, past newest first, keeping the pick", () => {
    const split = splitFeed(queue, 2, feed, new Map());
    expect(split.current?.trackId).toBe(tid("b"));
    expect(split.current?.pick).toBe("explore");
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
