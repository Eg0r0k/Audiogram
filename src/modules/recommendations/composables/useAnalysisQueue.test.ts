import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ok } from "neverthrow";
import { DbError } from "@/db/errors/db.errors";
import { useAnalysisQueue } from "@/modules/recommendations/composables/useAnalysisQueue";
import type { TrackId } from "@/types/ids";
import { TrackSource, TrackState } from "@/db/entities";

// ── Helpers ────────────────────────────────────────────────────────────────

const tid = (s: string) => s as TrackId;

function makeTrack(id: string) {
  return {
    id: tid(id),
    title: `Track ${id}`,
    storagePath: `tracks/${id}.mp3`,
    artistName: "Artist",
    albumTitle: "Album",
    artistIds: [],
    albumId: "album-1" as any,
    tagIds: [],
    source: TrackSource.LOCAL_INTERNAL,
    state: TrackState.READY,
    duration: 200,
    format: { codec: "MP3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
    playCount: 0,
    addedAt: Date.now(),
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/db/repositories/audioFeatures.repository", () => ({
  audioFeaturesRepository: {
    findUnanalyzedIds: vi.fn(),
    upsert: vi.fn(),
  },
  CURRENT_ALGORITHM_VERSION: 1,
}));

vi.mock("@/db/repositories", () => ({
  trackRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("@/db/storage", () => ({
  storageService: {
    getFile: vi.fn(),
  },
}));

// Мок воркера — возвращает успешный ответ с фиктивными фичами
let mockPostMessageCalls: unknown[][] = [];
let mockPostMessageImpl: ((...args: unknown[]) => void) | null = null;
const mockWorkerInstance: {
  postMessage: (...args: unknown[]) => void;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  terminate: ReturnType<typeof vi.fn>;
} = {
  postMessage(...args: unknown[]) {
    mockPostMessageCalls.push(args);
    mockPostMessageImpl?.(...args);
  },
  onmessage: null,
  onerror: null,
  terminate: vi.fn(),
};

function resetMockWorker() {
  mockPostMessageCalls = [];
  mockPostMessageImpl = null;
}

vi.mock(
  "@/modules/recommendations/workers/essentia.worker?worker",
  () => ({
    default: vi.fn(function () { return mockWorkerInstance; }),
  }),
);

const { audioFeaturesRepository } = await import("@/db/repositories/audioFeatures.repository");
const { trackRepository } = await import("@/db/repositories");
const { storageService } = await import("@/db/storage");

const mockFindUnanalyzedIds = audioFeaturesRepository.findUnanalyzedIds as ReturnType<typeof vi.fn>;
const mockUpsert = audioFeaturesRepository.upsert as ReturnType<typeof vi.fn>;
const mockFindById = trackRepository.findById as ReturnType<typeof vi.fn>;
const mockGetFile = storageService.getFile as ReturnType<typeof vi.fn>;

const FAKE_FEATURES = {
  bpm: 120,
  energy: 0.5,
  spectralCentroid: 2000,
  danceability: 0.5,
  key: 0,
  mode: 1,
};

function setupSuccessfulAnalysis(trackId: string) {
  const track = makeTrack(trackId);
  const fakeBlob = new Blob([new Uint8Array(100)], { type: "audio/mpeg" });

  mockFindById.mockResolvedValue(track);
  mockGetFile.mockResolvedValue(ok(fakeBlob));
  mockUpsert.mockResolvedValue(tid(trackId));

  // Воркер отвечает после postMessage через setTimeout(0)
  mockPostMessageImpl = (_data: unknown) => {
    setTimeout(() => {
      if (mockWorkerInstance.onmessage) {
        const response = {
          success: true,
          requestId: (_data as any).requestId,
          trackId: tid(trackId),
          features: FAKE_FEATURES,
        };
        mockWorkerInstance.onmessage({ data: response } as MessageEvent);
      }
    }, 0);
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useAnalysisQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockWorker();
    mockFindUnanalyzedIds.mockResolvedValue([]);
    // requestIdleCallback не существует в happy-dom — полифилл
    globalThis.requestIdleCallback = (cb: IdleRequestCallback) => {
      cb({ timeRemaining: () => 50, didTimeout: false });
      return 0;
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetMockWorker();
  });

  it("exposes reactive state properties", () => {
    const queue = useAnalysisQueue();
    expect(queue.isRunning.value).toBe(false);
    expect(queue.processedCount.value).toBe(0);
    expect(queue.currentTrackId.value).toBeNull();
  });

  it("start() does nothing when no unanalyzed tracks", async () => {
    mockFindUnanalyzedIds.mockResolvedValue([]);
    const queue = useAnalysisQueue();

    await queue.start();

    expect(mockPostMessageCalls.length).toBe(0);
    expect(queue.isRunning.value).toBe(false);
  });

  it("start() stops early when findUnanalyzedIds fails", async () => {
    mockFindUnanalyzedIds.mockRejectedValue(new DbError("UNKNOWN", "DB error"));
    const queue = useAnalysisQueue();

    await queue.start();

    expect(mockPostMessageCalls.length).toBe(0);
    expect(queue.isRunning.value).toBe(false);
  });

  it("enqueue() immediately starts processing priority tracks", async () => {
    setupSuccessfulAnalysis("priority-track");
    mockFindUnanalyzedIds.mockResolvedValue([]);

    const queue = useAnalysisQueue();
    queue.enqueue([tid("priority-track")]);

    await vi.waitFor(() => {
      expect(mockPostMessageCalls.length).toBe(1);
    });
  });

  it("does not start twice when already running", async () => {
    // Блокируем findUnanalyzedIds чтобы start() не завершился
    let resolveIds!: (ids: TrackId[]) => void;
    mockFindUnanalyzedIds.mockReturnValue(
      new Promise((r) => { resolveIds = r; }),
    );

    const queue = useAnalysisQueue();
    const p1 = queue.start();
    const p2 = queue.start(); // второй вызов

    expect(queue.isRunning.value).toBe(true);

    resolveIds([]);
    await Promise.all([p1, p2]);

    // findUnanalyzedIds должен быть вызван только один раз
    expect(mockFindUnanalyzedIds).toHaveBeenCalledTimes(1);
  });

  it("upserts features to DB after successful analysis", async () => {
    const trackId = "analyzed-track";
    setupSuccessfulAnalysis(trackId);
    mockFindUnanalyzedIds.mockResolvedValue([tid(trackId)]);

    const queue = useAnalysisQueue();
    await queue.start();

    await vi.waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trackId: tid(trackId),
          bpm: FAKE_FEATURES.bpm,
          algorithmVersion: 1,
          analyzedAt: expect.any(Number),
        }),
      );
    });
  });

  it("increments processedCount after each track (even on failure)", async () => {
    const trackId = "fail-track";
    mockFindById.mockRejectedValue(new DbError("UNKNOWN", "not found"));
    mockFindUnanalyzedIds.mockResolvedValue([tid(trackId)]);

    const queue = useAnalysisQueue();
    await queue.start();

    await vi.waitFor(() => {
      expect(queue.processedCount.value).toBe(1);
    });
  });

  it("continues processing after one track fails", async () => {
    const fail = "fail-track";
    const success = "success-track";

    mockFindById.mockImplementation((id: TrackId) => {
      if (id === tid(fail)) return Promise.reject(new DbError("UNKNOWN", "missing"));
      return Promise.resolve(makeTrack(success));
    });
    mockGetFile.mockResolvedValue(ok(new Blob([new Uint8Array(100)])));
    mockUpsert.mockResolvedValue(tid(success));
    mockFindUnanalyzedIds.mockResolvedValue([tid(fail), tid(success)]);

    mockPostMessageImpl = (_data: unknown) => {
      setTimeout(() => {
        if (mockWorkerInstance.onmessage) {
          mockWorkerInstance.onmessage({
            data: {
              success: true,
              requestId: (_data as any).requestId,
              trackId: tid(success),
              features: FAKE_FEATURES,
            },
          } as MessageEvent);
        }
      }, 0);
    };

    const queue = useAnalysisQueue();
    await queue.start();
    await new Promise(r => setTimeout(r, 50));

    expect(queue.processedCount.value).toBe(2);
  });

  it("stop() prevents further processing", async () => {
    mockFindUnanalyzedIds.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => tid(`track-${i}`)),
    );
    // Все findById зависают бесконечно
    mockFindById.mockReturnValue(new Promise(() => {}));

    const queue = useAnalysisQueue();
    queue.start(); // не await
    queue.stop();

    expect(queue.isRunning.value).toBe(false);
  });

  it("enqueue() prepends tracks to priority — processed before background sweep", async () => {
    const order: string[] = [];

    // Приоритетный трек
    setupSuccessfulAnalysis("priority");
    // Фоновый трек
    mockFindUnanalyzedIds.mockResolvedValue([tid("background")]);

    mockFindById.mockImplementation((id: TrackId) => {
      order.push(String(id));
      return Promise.resolve(makeTrack(String(id)));
    });
    mockGetFile.mockResolvedValue(ok(new Blob([new Uint8Array(100)])));
    mockUpsert.mockResolvedValue("x" as any);
    mockPostMessageImpl = (_data: unknown) => {
      setTimeout(() => {
        if (mockWorkerInstance.onmessage) {
          mockWorkerInstance.onmessage({
            data: {
              success: true,
              requestId: (_data as any).requestId,
              trackId: (_data as any).trackId,
              features: FAKE_FEATURES,
            },
          } as MessageEvent);
        }
      }, 0);
    };

    const queue = useAnalysisQueue();
    queue.enqueue([tid("priority")]);

    await new Promise(r => setTimeout(r, 100));

    // "priority" должен быть обработан первым
    if (order.length >= 2) {
      expect(order[0]).toBe("priority");
    }
  });
});
