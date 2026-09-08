import { describe, it, expect, vi, beforeEach } from "vitest";
import { err, ok } from "neverthrow";
import type { AudioFeaturesEntity, ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackId } from "@/types/ids";

const tid = (s: string) => s as TrackId;
const DAY = 86_400_000;
const MINUTE = 60_000;

const makeTrack = (id: string, o: Partial<TrackEntity> = {}): TrackEntity => ({
  id: tid(id), title: `Track ${id}`, artistName: "Artist", albumTitle: "Album", artistIds: [`ar-${id}` as any], albumId: "al" as any, tagIds: [],
  source: TrackSource.LOCAL_INTERNAL, storagePath: `tracks/${id}.mp3`, state: TrackState.READY, duration: 200,
  format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
  pinned: 0 as any, playCount: 0, addedAt: 0, ...o,
});
const makeEvent = (trackId: string, startedAt: number, o: Partial<ListenEventEntity> = {}): ListenEventEntity => ({
  id: `${trackId}-${startedAt}`, trackId: tid(trackId), artistId: `ar-${trackId}` as any, albumId: "al" as any,
  startedAt, secondsListened: 180, trackDuration: 200, completed: true, skipped: false, origin: "user", ...o,
});
const makeFeatures = (trackId: string, o: Partial<AudioFeaturesEntity> = {}): AudioFeaturesEntity => ({
  trackId: tid(trackId), bpm: 120, energy: 0.5, spectralCentroid: 2000, danceability: 0.5, key: 0, mode: 1,
  analyzedAt: 0, algorithmVersion: 1, ...o,
});

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/db/repositories", () => ({
  trackRepository: { findAll: vi.fn() },
}));
vi.mock("@/db/repositories/stats.repository", () => ({
  statsRepository: { findAllEvents: vi.fn() },
  SESSION_GAP_MS: 30 * 60 * 1000,
}));
vi.mock("@/db/repositories/audioFeatures.repository", () => ({
  audioFeaturesRepository: { findAll: vi.fn() },
  CURRENT_ALGORITHM_VERSION: 1,
}));

const { trackRepository } = await import("@/db/repositories");
const { statsRepository } = await import("@/db/repositories/stats.repository");
const { audioFeaturesRepository } = await import("@/db/repositories/audioFeatures.repository");
const { getRecommendations } = await import("@/modules/recommendations/service/recommender.service");
const { markRecommenderContextDirty } = await import("@/modules/recommendations/service/recommender-context.service");

const mockFindAll = trackRepository.findAll as ReturnType<typeof vi.fn>;
const mockFindAllEvents = statsRepository.findAllEvents as ReturnType<typeof vi.fn>;
const mockFeaturesFindAll = audioFeaturesRepository.findAll as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  markRecommenderContextDirty();
  mockFindAllEvents.mockResolvedValue(ok([]));
  mockFeaturesFindAll.mockResolvedValue(ok([]));
});

describe("getRecommendations", () => {
  it("returns [] when the seed track is unknown", async () => {
    mockFindAll.mockResolvedValue(ok([makeTrack("A")]));
    expect(await getRecommendations(tid("S"))).toEqual([]);
  });

  it("returns [] when tracks cannot be read, and retries the repository on the next call", async () => {
    mockFindAll.mockResolvedValueOnce(err(new Error("db")));
    expect(await getRecommendations(tid("S"))).toEqual([]);
    expect(mockFindAll).toHaveBeenCalledTimes(1);

    mockFindAll.mockResolvedValueOnce(ok([makeTrack("S"), makeTrack("A")]));
    const recs = await getRecommendations(tid("S"));
    expect(mockFindAll).toHaveBeenCalledTimes(2);
    expect(recs.map(r => r.trackId)).toEqual([tid("A")]);
  });

  it("excludes the seed, explicit ids and the recently played tracks", async () => {
    const now = Date.now();
    mockFindAll.mockResolvedValue(ok(["S", "A", "B", "C", "D", "E"].map(id => makeTrack(id))));
    mockFindAllEvents.mockResolvedValue(ok([
      makeEvent("B", now - MINUTE),
      makeEvent("D", now - 2 * MINUTE),
      makeEvent("E", now - 3 * MINUTE),
    ]));
    const ids = (await getRecommendations(tid("S"), 10, [tid("C")])).map(r => r.trackId);
    expect(ids.sort()).toEqual(["A"]);
  });

  it("returns non-empty recommendations, without the seed, when history is empty and features tie", async () => {
    mockFindAll.mockResolvedValue(ok(["S", "A", "B"].map(id => makeTrack(id))));
    mockFeaturesFindAll.mockResolvedValue(ok(["S", "A", "B"].map(id => makeFeatures(id))));
    const recs = await getRecommendations(tid("S"));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.trackId === tid("S"))).toBe(false);
  });

  it("ranks a track with completed listens above one with early skips", async () => {
    const now = Date.now();
    mockFindAll.mockResolvedValue(ok(["S", "A", "B"].map(id => makeTrack(id))));
    mockFindAllEvents.mockResolvedValue(ok([
      makeEvent("A", now - 10 * DAY, { completed: true, skipped: false, secondsListened: 200 }),
      makeEvent("A", now - 8 * DAY, { completed: true, skipped: false, secondsListened: 200 }),
      makeEvent("B", now - 10 * DAY, { completed: false, skipped: true, secondsListened: 5 }),
      makeEvent("B", now - 8 * DAY, { completed: false, skipped: true, secondsListened: 5 }),
      // Padding so A/B fall out of the RECENT_EXCLUDE=3 window (ctx.recentlyPlayed
      // holds the globally-newest unique tracks) while staying inside MAX_HISTORY_DAYS.
      makeEvent("PAD1", now - MINUTE),
      makeEvent("PAD2", now - 2 * MINUTE),
      makeEvent("PAD3", now - 3 * MINUTE),
    ]));
    const recs = await getRecommendations(tid("S"), 10);
    const order = recs.map(r => r.trackId);
    expect(order.indexOf(tid("A"))).toBeLessThan(order.indexOf(tid("B")));
  });

  it("leaves breakdown.audioSimilarity null when the seed has no audio features", async () => {
    mockFindAll.mockResolvedValue(ok(["S", "A", "B"].map(id => makeTrack(id))));
    mockFeaturesFindAll.mockResolvedValue(ok([makeFeatures("A"), makeFeatures("B", { bpm: 140 })]));
    const recs = await getRecommendations(tid("S"));
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every(r => r.breakdown.audioSimilarity === null)).toBe(true);
  });

  it("respects limit and the default MMR artist cap", async () => {
    mockFindAll.mockResolvedValue(ok([
      makeTrack("S"),
      ...["A1", "A2", "A3"].map(id => makeTrack(id, { artistIds: [tid("same") as any], likedAt: 1 })),
      makeTrack("B", { artistIds: [tid("other") as any] }),
    ]));
    const recs = await getRecommendations(tid("S"), 3);
    expect(recs.length).toBe(3);
    const sameArtistCount = recs.filter(r => r.track.artistIds[0] === tid("same")).length;
    expect(sameArtistCount).toBeLessThanOrEqual(2);
  });
});
