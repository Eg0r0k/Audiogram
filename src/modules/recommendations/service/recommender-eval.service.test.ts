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

describe("runRecommenderEval", () => {
  it("fills every report field, with examples === positives + negatives", async () => {
    const now = Date.now();
    const tracks = ["seed", ...Array.from({ length: 3 }, (_, i) => `c${i}`)].map(id => ({
      id, title: id, artistName: "Artist", albumTitle: "Album", artistIds: [`ar-${id}`], albumId: "al", tagIds: [],
      source: "LOCAL_INTERNAL", storagePath: `t/${id}.mp3`, state: "READY", duration: 200,
      format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
      pinned: 0, playCount: 0, addedAt: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fixture, full entity typing not needed for this test
    } as any));

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

    expect(report.examples).toBe(report.positives + report.negatives);
    expect(report.examples).toBeGreaterThan(0);
    expect(report.aucDefault === null || typeof report.aucDefault === "number").toBe(true);
    expect(report.aucLearned === null).toBe(true); // too few examples for trainWeights to succeed
    expect(report.autoplayPlays14d).toBeGreaterThanOrEqual(0);
    expect(report.autoplaySkipRate14d === null || typeof report.autoplaySkipRate14d === "number").toBe(true);
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
    });
  });
});
