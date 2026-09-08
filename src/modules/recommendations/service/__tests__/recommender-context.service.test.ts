import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok } from "neverthrow";

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
const { getRecommenderContext, markRecommenderContextDirty } = await import(
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
});
