import { describe, it, expect } from "vitest";
import { collectSignals, collectSignalMatrix, SIGNAL_KEYS, toVector } from "@/modules/recommendations/service/signals";
import { buildRecommendationContextFromData } from "@/modules/recommendations/service/recommendation-context";
import type { ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;
const DAY = 86_400_000;
const MINUTE = 60_000;
const NOW = 100 * DAY;

const makeTrack = (id: string, o: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid(id), title: id, artistName: "", albumTitle: "", artistIds: [], albumId: "al" as any, tagIds: [],
  source: TrackSource.LOCAL_INTERNAL, state: TrackState.READY, duration: 200,
  format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
  pinned: 0 as any, playCount: 0, addedAt: 0, ...o,
});
const makeEvent = (trackId: string, startedAt: number, o: Partial<ListenEventEntity> = {}): ListenEventEntity => ({
  id: `${trackId}-${startedAt}`, trackId: tid(trackId), artistId: "ar1" as any, albumId: "al" as any,
  startedAt, secondsListened: 100, trackDuration: 200, completed: true, skipped: false, ...o,
});

const tracks = [
  makeTrack("S", { artistIds: ["ar1" as any], tagIds: ["rock", "90s"] as any }),
  makeTrack("A", { artistIds: ["ar1" as any], tagIds: ["rock"] as any, likedAt: 1, lastPlayedAt: NOW - 30 * DAY }),
  makeTrack("B", { artistIds: ["ar2" as any], tagIds: [] }),
  makeTrack("C", { artistIds: ["ar3" as any], tagIds: ["jazz"] as any }),
];
const events = [
  makeEvent("S", NOW - 10 * DAY),
  makeEvent("A", NOW - 10 * DAY + MINUTE),
  makeEvent("B", NOW - 10 * DAY + 2 * MINUTE, { artistId: "ar2" as any, completed: false }),
  makeEvent("S", NOW - 5 * DAY),
  makeEvent("A", NOW - 5 * DAY + MINUTE),
  makeEvent("B", NOW - 1 * DAY, { artistId: "ar2" as any, skipped: true }),
];
const ctx = buildRecommendationContextFromData(tracks, events, NOW);

describe("collectSignals", () => {
  it("keeps every signal within [0, 1]", () => {
    for (const cand of ["A", "B", "C"]) {
      const v = collectSignals(tid("S"), tid(cand), ctx);
      for (const k of SIGNAL_KEYS) {
        expect(v[k], `${cand}.${k}`).toBeGreaterThanOrEqual(0);
        expect(v[k], `${cand}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("metadata signals", () => {
    const a = collectSignals(tid("S"), tid("A"), ctx);
    const b = collectSignals(tid("S"), tid("B"), ctx);
    const c = collectSignals(tid("S"), tid("C"), ctx);
    expect(a.sameArtist).toBe(1);
    expect(b.sameArtist).toBe(0);
    expect(a.tagOverlap).toBeCloseTo(1 / 2, 6);
    expect(b.tagOverlap).toBe(0);
    expect(c.tagOverlap).toBe(0);
    expect(a.liked).toBe(1);
    expect(c.liked).toBe(0);
  });

  it("co-occurrence is relative to the source's strongest pair", () => {
    const a = collectSignals(tid("S"), tid("A"), ctx);
    const b = collectSignals(tid("S"), tid("B"), ctx);
    const c = collectSignals(tid("S"), tid("C"), ctx);
    expect(a.coOccurrence).toBe(1);
    expect(b.coOccurrence).toBeGreaterThan(0);
    expect(b.coOccurrence).toBeLessThan(1);
    expect(c.coOccurrence).toBe(0);
    expect(b.artistCoOccurrence).toBeGreaterThan(0);
    expect(c.artistCoOccurrence).toBe(0);
    expect(a.artistCoOccurrence).toBe(0);
  });

  it("session exclusion removes that session's contribution", () => {
    const withB = collectSignals(tid("S"), tid("B"), ctx);
    const without = collectSignals(tid("S"), tid("B"), ctx, {
      exclude: { tracks: new Set([tid("S"), tid("A"), tid("B")]), artists: new Set(["ar1", "ar2"] as any) },
    });
    expect(withB.coOccurrence).toBeGreaterThan(0);
    expect(without.coOccurrence).toBe(0);
    expect(without.artistCoOccurrence).toBe(0);
  });

  it("stats signals with defaults for unseen tracks", () => {
    const a = collectSignals(tid("S"), tid("A"), ctx);
    const b = collectSignals(tid("S"), tid("B"), ctx);
    const c = collectSignals(tid("S"), tid("C"), ctx);
    expect(a.completionRate).toBe(1);
    expect(b.completionRate).toBe(0);
    expect(c.completionRate).toBe(0.5);
    expect(b.skipRate).toBeCloseTo(0.5, 6);
    expect(c.skipRate).toBe(0.5);
    expect(a.artistAffinity).toBe(1);
    expect(b.artistAffinity).toBeGreaterThan(0);
    expect(c.artistAffinity).toBe(0);
  });

  it("recency and novelty", () => {
    const a = collectSignals(tid("S"), tid("A"), ctx);
    const c = collectSignals(tid("S"), tid("C"), ctx);
    expect(a.recency).toBeCloseTo(Math.exp(-1), 6);
    expect(a.novelty).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(c.recency).toBe(0.6);
    expect(c.novelty).toBe(1);
  });

  it("audio similarity is 0 without a lookup and euclidean with one", () => {
    expect(collectSignals(tid("S"), tid("A"), ctx).audioSimilarity).toBe(0);
    const v = { bpm: 0.5, energy: 0.5, spectralCentroid: 0.5, danceability: 0.5, key: 0.5, mode: 1 };
    const audio = { source: v, byId: new Map([[tid("A"), { ...v }]]) };
    expect(collectSignals(tid("S"), tid("A"), ctx, { audio }).audioSimilarity).toBeCloseTo(1, 6);
    expect(collectSignals(tid("S"), tid("B"), ctx, { audio }).audioSimilarity).toBe(0);
  });
});

describe("collectSignalMatrix", () => {
  it("lays vectors out in SIGNAL_KEYS order with artist keys", () => {
    const m = collectSignalMatrix(tid("S"), [tid("A"), tid("C")], ctx);
    expect(m.candidateIds).toEqual(["A", "C"]);
    expect(m.artistKeys).toEqual(["ar1", "ar3"]);
    expect(m.data.length).toBe(2 * SIGNAL_KEYS.length);
    const a = collectSignals(tid("S"), tid("A"), ctx);
    SIGNAL_KEYS.forEach((k, i) => expect(m.data[i]).toBeCloseTo(a[k], 5));
  });
});

describe("toVector", () => {
  it("normalizes and clamps bpm", () => {
    const f = { trackId: tid("A"), bpm: 300, energy: 0.5, spectralCentroid: 4000, danceability: 0.5, key: 11, mode: 0, analyzedAt: 0, algorithmVersion: 1 };
    const v = toVector(f);
    expect(v.bpm).toBe(1);
    expect(v.spectralCentroid).toBe(0.5);
    expect(v.key).toBe(1);
  });
});
