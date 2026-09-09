import { describe, it, expect, vi } from "vitest";

const { getRecommenderContextMock } = vi.hoisted(() => ({
  getRecommenderContextMock: vi.fn(),
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
vi.mock("@/modules/recommendations/service/recommender-context.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/recommendations/service/recommender-context.service")>();
  return { ...actual, getRecommenderContext: getRecommenderContextMock };
});

const { buildRecommenderContext } = await import("@/modules/recommendations/service/recommender-context.service");
const { runRecommenderEval } = await import("@/modules/recommendations/service/recommender-eval.service");

const DAY = 86_400_000;

const makeTrack = (id: string) => ({
  id, title: id, artistName: "Artist", albumTitle: "Album", artistIds: [`ar-${id}`], albumId: "al", tagIds: [],
  source: "LOCAL_INTERNAL", storagePath: `t/${id}.mp3`, state: "READY", duration: 200,
  format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
  pinned: 0, playCount: 0, addedAt: 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fixture, full entity typing not needed for this test
} as any);

describe("runRecommenderEval", () => {
  it("fills every report field with a deterministic outcome when there are too few examples to train", async () => {
    const now = Date.now();
    const tracks = ["seed", ...Array.from({ length: 3 }, (_, i) => `c${i}`)].map(makeTrack);

    const events: unknown[] = [];
    let t = now - 5 * DAY;
    for (let i = 0; i < 6; i++) {
      const label = i % 2 === 0
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
    const ctx = buildRecommenderContext({ tracks, features: [], events: events as any, now });
    getRecommenderContextMock.mockResolvedValue(ctx);

    const report = await runRecommenderEval();

    // 6 examples, 3 positive (completed) + 3 negative (early skip) — too few for
    // trainWeights (min 15/15), and a 20%-holdout of 1 example can never contain
    // both a positive and a negative, so both AUCs are deterministically null.
    expect(report.examples).toBe(report.positives + report.negatives);
    expect(report.positives).toBe(3);
    expect(report.negatives).toBe(3);
    expect(report.aucDefault).toBeNull();
    expect(report.aucLearned).toBeNull();
    expect(report.weights).toBeNull();
    // All 6 autoplay events fall inside the 14-day window; 3 are early skips.
    expect(report.autoplayPlays14d).toBe(6);
    expect(report.autoplaySkipRate14d).toBe(0.5);
  });

  it("trains successfully and computes a learned AUC when there is enough labeled history", async () => {
    const now = Date.now();
    const tracks = ["seed", ...Array.from({ length: 4 }, (_, i) => `c${i}`)].map(makeTrack);

    const events: unknown[] = [];
    let t = now - 10 * DAY;
    // 50 runs, completed/early-skip interleaved so both classes are spread
    // across time — the chronological train/holdout split each keep >= 15 of both.
    for (let i = 0; i < 50; i++) {
      const label = i % 2 === 0
        ? { completed: true, skipped: false, secondsListened: 180 }
        : { completed: false, skipped: true, secondsListened: 5 };
      events.push({
        id: `u-${i}`, trackId: "seed", artistId: "ar-seed", albumId: "al",
        startedAt: t, secondsListened: 180, trackDuration: 200, completed: true, skipped: false, origin: "user",
      });
      t += 60_000;
      events.push({
        id: `a-${i}`, trackId: `c${i % 4}`, artistId: `ar-c${i % 4}`, albumId: "al",
        startedAt: t, trackDuration: 200, origin: "autoplay", ...label,
      });
      t += 60_000;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fixture, full entity typing not needed for this test
    const ctx = buildRecommenderContext({ tracks, features: [], events: events as any, now });
    getRecommenderContextMock.mockResolvedValue(ctx);

    const report = await runRecommenderEval();

    expect(report.examples).toBe(report.positives + report.negatives);
    expect(report.weights).not.toBeNull();
    const sum = Object.values(report.weights!).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(typeof report.aucDefault).toBe("number");
    expect(typeof report.aucLearned).toBe("number");
    expect(report.aucLearned!).toBeGreaterThanOrEqual(0);
    expect(report.aucLearned!).toBeLessThanOrEqual(1);
  });

  it("returns nulls without throwing when there is no autoplay history", async () => {
    const now = Date.now();
    const ctx = buildRecommenderContext({ tracks: [], features: [], events: [], now });
    getRecommenderContextMock.mockResolvedValue(ctx);

    const report = await runRecommenderEval();

    expect(report).toEqual({
      examples: 0,
      positives: 0,
      negatives: 0,
      aucDefault: null,
      aucLearned: null,
      weights: null,
      autoplaySkipRate14d: null,
      autoplayPlays14d: 0,
      picks14d: {
        rank: { plays: 0, completed: 0, earlySkips: 0 },
        explore: { plays: 0, completed: 0, earlySkips: 0 },
      },
    });
  });
});
