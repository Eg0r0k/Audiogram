import { describe, it, expect, vi, beforeEach } from "vitest";
import { err, ok } from "neverthrow";
import type { RecommenderModelEntity } from "@/db/entities";
import { DEFAULT_WEIGHTS, COMPONENT_KEYS } from "@/modules/recommendations/lib/scoring";
import type * as RecommenderModelModule from "@/modules/recommendations/service/recommender-model.service";

const { recommenderModelRepository, getRecommenderContextMock } = vi.hoisted(() => ({
  recommenderModelRepository: { get: vi.fn(), put: vi.fn() },
  getRecommenderContextMock: vi.fn(),
}));

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
vi.mock("@/db/repositories/recommenderModel.repository", () => ({ recommenderModelRepository }));
vi.mock("@/modules/recommendations/service/recommender-context.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/recommendations/service/recommender-context.service")>();
  return { ...actual, getRecommenderContext: getRecommenderContextMock };
});

const { buildRecommenderContext } = await import("@/modules/recommendations/service/recommender-context.service");

const mockGet = recommenderModelRepository.get;
const mockPut = recommenderModelRepository.put;
const mockGetCtx = getRecommenderContextMock;

const DAY = 86_400_000;

const learnedWeights = { audio: 0.5, trackTransition: 0.1, artistTransition: 0.1, affinity: 0.2, explore: 0.1 };

const makeRow = (o: Partial<RecommenderModelEntity> = {}): RecommenderModelEntity => ({
  id: "weights",
  weights: learnedWeights,
  trainedAt: Date.now(),
  examples: 200,
  positives: 100,
  negatives: 100,
  ...o,
});

const emptyCtx = () => buildRecommenderContext({ tracks: [], features: [], events: [], now: Date.now() });

// The service holds module-level state (weights cache, in-flight training,
// last-failed-attempt throttle) — reload it fresh for every test.
let service: typeof RecommenderModelModule;

beforeEach(async () => {
  vi.resetModules();
  mockGet.mockReset();
  mockPut.mockReset();
  mockGetCtx.mockReset().mockResolvedValue(emptyCtx());
  service = await import("@/modules/recommendations/service/recommender-model.service");
});

describe("getActiveWeights", () => {
  it("returns DEFAULT_WEIGHTS when there is no stored model", async () => {
    mockGet.mockResolvedValue(ok(null));
    expect(await service.getActiveWeights()).toEqual(DEFAULT_WEIGHTS);
  });

  it("returns the learned weights exactly when examples is at the blend's fullAt (200)", async () => {
    mockGet.mockResolvedValue(ok(makeRow({ examples: 200 })));
    expect(await service.getActiveWeights()).toEqual(learnedWeights);
  });

  it("blends to the midpoint when examples is half of fullAt", async () => {
    mockGet.mockResolvedValue(ok(makeRow({ examples: 100 })));
    const w = await service.getActiveWeights();
    for (const key of COMPONENT_KEYS) {
      expect(w[key]).toBeCloseTo((DEFAULT_WEIGHTS[key] + learnedWeights[key]) / 2, 10);
    }
  });

  it("returns DEFAULT_WEIGHTS when the repository errors", async () => {
    mockGet.mockResolvedValue(err(new Error("db")));
    expect(await service.getActiveWeights()).toEqual(DEFAULT_WEIGHTS);
  });

  it("caches: a second call does not hit the repository again", async () => {
    mockGet.mockResolvedValue(ok(null));
    await service.getActiveWeights();
    await service.getActiveWeights();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("invalidateWeightsCache forces a re-read", async () => {
    mockGet.mockResolvedValue(ok(null));
    await service.getActiveWeights();
    service.invalidateWeightsCache();
    await service.getActiveWeights();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe("ensureModelFresh", () => {
  it("is a no-op when the stored model's trainedAt is fresh (< 24h) — no context load, no save", async () => {
    mockGet.mockResolvedValue(ok(makeRow({ trainedAt: Date.now() - 1000 })));
    await service.ensureModelFresh();
    expect(mockGetCtx).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("trains when there is no stored model, and does not save when there are too few examples", async () => {
    mockGet.mockResolvedValue(ok(null));
    await service.ensureModelFresh();
    expect(mockGetCtx).toHaveBeenCalledTimes(1);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("trains when the stored model is stale (>= 24h old)", async () => {
    mockGet.mockResolvedValue(ok(makeRow({ trainedAt: Date.now() - 25 * 60 * 60 * 1000 })));
    await service.ensureModelFresh();
    expect(mockGetCtx).toHaveBeenCalledTimes(1);
  });

  it("runs only one training when called concurrently", async () => {
    mockGet.mockResolvedValue(ok(makeRow({ trainedAt: Date.now() - 25 * 60 * 60 * 1000 })));
    await Promise.all([service.ensureModelFresh(), service.ensureModelFresh()]);
    expect(mockGetCtx).toHaveBeenCalledTimes(1);
  });

  it("never rejects, even when the context load fails", async () => {
    mockGet.mockResolvedValue(ok(null));
    mockGetCtx.mockReset().mockRejectedValue(new Error("boom"));
    await expect(service.ensureModelFresh()).resolves.toBeUndefined();
  });

  it("saves the learned model and invalidates the weights cache when there are enough examples", async () => {
    mockGet.mockResolvedValue(ok(null));
    mockPut.mockResolvedValue(ok(undefined));

    const tracks = ["seed", ...Array.from({ length: 3 }, (_, i) => `c${i}`)].map(id => ({
      id, title: id, artistName: "Artist", albumTitle: "Album", artistIds: [`ar-${id}`], albumId: "al", tagIds: [],
      source: "LOCAL_INTERNAL", storagePath: `t/${id}.mp3`, state: "READY", duration: 200,
      format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
      pinned: 0, playCount: 0, addedAt: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fixture, full entity typing not needed for this test
    } as any));

    const now = Date.now();
    const events: unknown[] = [];
    let t = now - 5 * DAY;
    for (let i = 0; i < 30; i++) {
      const label = i < 15
        ? { completed: true, skipped: false, secondsListened: 180 }
        : { completed: false, skipped: true, secondsListened: 5 };
      events.push({
        id: `u-${i}`, trackId: "seed", artistId: "ar-seed", albumId: "al",
        startedAt: t, secondsListened: 180, trackDuration: 200, completed: true, skipped: false, origin: "user",
      });
      t += 60_000;
      events.push({
        id: `a-${i}`, trackId: `c${i % 3}`, artistId: `ar-c${i % 3}`, albumId: "al",
        startedAt: t, trackDuration: 200, origin: "autoplay", ...label,
      });
      t += 60_000;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fixture, full entity typing not needed for this test
    mockGetCtx.mockResolvedValue(buildRecommenderContext({ tracks, features: [], events: events as any, now }));

    await service.ensureModelFresh();

    expect(mockPut).toHaveBeenCalledTimes(1);
    const saved = mockPut.mock.calls[0][0];
    expect(saved.examples).toBe(30);
    expect(saved.positives).toBe(15);
    expect(saved.negatives).toBe(15);
    expect(saved.weights).toBeTruthy();
  });
});
