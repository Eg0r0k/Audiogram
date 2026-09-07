import { describe, it, expect } from "vitest";
import { buildRecommendationContextFromData } from "@/modules/recommendations/service/recommendation-context";
import type { ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;
const MINUTE = 60_000;

const makeTrack = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid(id), title: id, artistName: "", albumTitle: "", artistIds: [], albumId: "al" as any, tagIds: [],
  source: TrackSource.LOCAL_INTERNAL, state: TrackState.READY, duration: 200,
  format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
  pinned: 0 as any, playCount: 0, addedAt: 0, ...overrides,
});

const makeEvent = (trackId: string, startedAt: number, o: Partial<ListenEventEntity> = {}): ListenEventEntity => ({
  id: `${trackId}-${startedAt}`, trackId: tid(trackId), artistId: "ar1" as any, albumId: "al" as any,
  startedAt, secondsListened: 100, trackDuration: 200, completed: true, skipped: false, ...o,
});

describe("buildRecommendationContextFromData", () => {
  it("aggregates track stats, artist seconds and recently played", () => {
    const tracks = [makeTrack("A"), makeTrack("B")];
    const events = [
      makeEvent("A", 0),
      makeEvent("A", MINUTE, { completed: false, secondsListened: 30 }),
      makeEvent("B", 2 * MINUTE, { skipped: true, secondsListened: 5, artistId: "ar2" as any }),
      makeEvent("B", 3 * MINUTE, { artistId: "ar2" as any, secondsListened: 50 }),
    ];
    const ctx = buildRecommendationContextFromData(tracks, events, 10 * MINUTE);

    expect(ctx.tracks.get(tid("A"))?.title).toBe("A");
    expect(ctx.trackStats.get(tid("A"))).toEqual({ completed: 1, total: 2, skipped: 0, seconds: 130 });
    expect(ctx.trackStats.get(tid("B"))).toEqual({ completed: 1, total: 2, skipped: 1, seconds: 55 });
    expect(ctx.artistSeconds.get("ar1" as any)).toBe(130);
    expect(ctx.artistSeconds.get("ar2" as any)).toBe(55);
    expect(ctx.maxArtistSeconds).toBe(130);
    expect(ctx.recentlyPlayed).toEqual(["B", "A"]);
    expect(ctx.trackSessions).toEqual([["A", "B"]]);
    expect(ctx.trackCo.raw.get(tid("A"))?.get(tid("B"))).toBe(1);
    expect(ctx.artistCo.raw.get("ar1" as any)?.get("ar2" as any)).toBe(1);
  });

  it("handles an empty history", () => {
    const ctx = buildRecommendationContextFromData([makeTrack("A")], [], 0);
    expect(ctx.trackSessions).toEqual([]);
    expect(ctx.recentlyPlayed).toEqual([]);
    expect(ctx.maxArtistSeconds).toBe(0);
  });
});
