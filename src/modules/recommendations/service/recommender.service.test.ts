import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import type { ListenEventEntity, TrackEntity } from "@/db/entities";
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

vi.mock("@/db/repositories", () => ({
  trackRepository: { findAll: vi.fn() },
}));
vi.mock("@/db/repositories/stats.repository", () => ({
  statsRepository: { eventsSince: vi.fn() },
  SESSION_GAP_MS: 30 * 60 * 1000,
}));
vi.mock("@/db/repositories/audioFeatures.repository", () => ({
  audioFeaturesRepository: { findById: vi.fn(), findManyByIds: vi.fn() },
  CURRENT_ALGORITHM_VERSION: 1,
}));

const { trackRepository } = await import("@/db/repositories");
const { statsRepository } = await import("@/db/repositories/stats.repository");
const { audioFeaturesRepository } = await import("@/db/repositories/audioFeatures.repository");
const { getRecommendations } = await import("@/modules/recommendations/service/recommender.service");

const mockFindAll = trackRepository.findAll as ReturnType<typeof vi.fn>;
const mockEventsSince = statsRepository.eventsSince as ReturnType<typeof vi.fn>;
const mockAudioById = audioFeaturesRepository.findById as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockEventsSince.mockResolvedValue(ok([]));
});

describe("getRecommendations", () => {
  it("returns [] when tracks cannot be read", async () => {
    mockFindAll.mockResolvedValue(err(new Error("db")));
    expect(await getRecommendations(tid("S"))).toEqual([]);
  });

  it("excludes the source, recently played and explicit ids", async () => {
    const now = Date.now();
    mockFindAll.mockResolvedValue(ok(["S", "A", "B", "C", "D"].map(id => makeTrack(id))));
    mockEventsSince.mockResolvedValue(ok([makeEvent("B", now - MINUTE)]));
    const ids = (await getRecommendations(tid("S"), 10, [tid("C")])).map(r => r.trackId);
    expect(ids.sort()).toEqual(["A", "D"]);
  });

  it("prefers a track that co-occurs with the source over a liked one", async () => {
    const now = Date.now();
    mockFindAll.mockResolvedValue(ok([
      makeTrack("S"),
      makeTrack("A"),
      makeTrack("L", { likedAt: 1 }),
    ]));
    mockEventsSince.mockResolvedValue(ok([
      makeEvent("S", now - 10 * DAY), makeEvent("A", now - 10 * DAY + MINUTE),
      makeEvent("S", now - 8 * DAY), makeEvent("A", now - 8 * DAY + MINUTE),
    ]));
    const recs = await getRecommendations(tid("S"), 10, [], { params: { recentWindow: 0 } });
    expect(recs[0].trackId).toBe("A");
    expect(recs[0].breakdown.coOccurrence).toBe(1);
    expect(recs.find(r => r.trackId === tid("L"))?.breakdown.liked).toBe(1);
  });

  it("does not read audio features when the audio weight is 0", async () => {
    mockFindAll.mockResolvedValue(ok([makeTrack("S"), makeTrack("A")]));
    await getRecommendations(tid("S"));
    expect(mockAudioById).not.toHaveBeenCalled();
  });

  it("respects limit and maxPerArtist", async () => {
    mockFindAll.mockResolvedValue(ok([
      makeTrack("S"),
      ...["A1", "A2", "A3"].map(id => makeTrack(id, { artistIds: ["same" as any], likedAt: 1 })),
      makeTrack("B", { artistIds: ["other" as any] }),
    ]));
    const recs = await getRecommendations(tid("S"), 3, [], { params: { maxPerArtist: 2 } });
    expect(recs.map(r => r.track.artistIds[0])).toEqual(["same", "same", "other"]);
  });
});
