import { describe, it, expect, vi, beforeEach } from "vitest";
import { err, ok } from "neverthrow";
import type { AudioFeaturesEntity, ListenEventEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackId } from "@/types/ids";

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
const { getRecommenderContext, markRecommenderContextDirty, buildRecommenderContext } = await import(
  "@/modules/recommendations/service/recommender-context.service"
);

const mockFindAll = trackRepository.findAll as ReturnType<typeof vi.fn>;
const mockFindAllEvents = statsRepository.findAllEvents as ReturnType<typeof vi.fn>;
const mockFeaturesFindAll = audioFeaturesRepository.findAll as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  markRecommenderContextDirty();
  mockFindAll.mockResolvedValue(ok([]));
  mockFindAllEvents.mockResolvedValue(ok([]));
  mockFeaturesFindAll.mockResolvedValue(ok([]));
});

describe("getRecommenderContext", () => {
  it("caches the built context until marked dirty", async () => {
    const first = await getRecommenderContext();
    const second = await getRecommenderContext();
    expect(second).toBe(first);
    expect(mockFindAll).toHaveBeenCalledTimes(1);

    markRecommenderContextDirty();
    const third = await getRecommenderContext();
    expect(third).not.toBe(first);
    expect(mockFindAll).toHaveBeenCalledTimes(2);
  });

  it("shares one build across parallel calls", async () => {
    const [a, b] = await Promise.all([getRecommenderContext(), getRecommenderContext()]);
    expect(a).toBe(b);
    expect(mockFindAll).toHaveBeenCalledTimes(1);
    expect(mockFindAllEvents).toHaveBeenCalledTimes(1);
    expect(mockFeaturesFindAll).toHaveBeenCalledTimes(1);
  });

  it("discards a build that resolves after a dirty mark raised while it was in flight", async () => {
    let resolveTracks: (value: unknown) => void = () => {};
    const deferred = new Promise((resolve) => { resolveTracks = resolve; });
    mockFindAll.mockReturnValueOnce(deferred);

    const firstCall = getRecommenderContext();
    // Dirty mark lands while the build above is still awaiting the deferred promise.
    markRecommenderContextDirty();
    resolveTracks(ok([]));
    const first = await firstCall;

    const second = await getRecommenderContext();
    expect(second).not.toBe(first);
    expect(mockFindAll).toHaveBeenCalledTimes(2);
  });

  it("does not cache a context built from a failed repository read, and retries on the next call", async () => {
    mockFindAll.mockResolvedValueOnce(err(new Error("db")));
    const first = await getRecommenderContext();
    expect(first.tracks.size).toBe(0);
    expect(mockFindAll).toHaveBeenCalledTimes(1);

    mockFindAll.mockResolvedValueOnce(ok([]));
    const second = await getRecommenderContext();
    expect(mockFindAll).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });
});

describe("buildRecommenderContext", () => {
  const tid = (s: string) => s as TrackId;
  const DAY = 86_400_000;
  const now = 1_800_000_000_000;

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

  it("keeps an event older than MAX_HISTORY_DAYS out of every session while still feeding affinity", () => {
    const events = [
      makeEvent("OLD", now - 91 * DAY),
      makeEvent("X", now - DAY),
      makeEvent("Y", now - DAY + 60_000),
    ];
    const ctx = buildRecommenderContext({
      tracks: [makeTrack("OLD"), makeTrack("X"), makeTrack("Y")],
      features: [],
      events,
      now,
    });

    expect(ctx.events).toHaveLength(3);
    expect(ctx.affinity.has(tid("OLD"))).toBe(true);
    expect(ctx.sessions.some(session => session.some(e => e.trackId === tid("OLD")))).toBe(false);
    expect(ctx.sessions.some(session =>
      session.some(e => e.trackId === tid("X")) && session.some(e => e.trackId === tid("Y")),
    )).toBe(true);
  });

  it("puts a liked track's affinity in the map even with no listen history", () => {
    const ctx = buildRecommenderContext({
      tracks: [makeTrack("A", { likedAt: now - DAY })],
      features: [],
      events: [],
      now,
    });
    const entry = ctx.affinity.get(tid("A"));
    expect(entry).toBeDefined();
    expect(entry!.score).toBeGreaterThan(0);
  });

  it("leaves audioSpace null with fewer than 2 feature rows and builds it with 2 or more", () => {
    const one = buildRecommenderContext({ tracks: [], features: [makeFeatures("A")], events: [], now });
    expect(one.audioSpace).toBeNull();

    const two = buildRecommenderContext({
      tracks: [],
      features: [makeFeatures("A"), makeFeatures("B", { bpm: 140 })],
      events: [],
      now,
    });
    expect(two.audioSpace).not.toBeNull();
  });
});
