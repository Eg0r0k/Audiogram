import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DbError } from "@/db/errors/db.errors";
import { queueSnapshotRepository, trackRepository } from "@/db/repositories";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { createPlayerPlaybackPort } from "@/modules/player/lib/queue-playback-port";
import { registerPlaybackPort } from "../lib/playback-port";
import { useQueueStore } from "../store/queue.store";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/db/repositories", () => ({
  trackRepository: { findByIds: vi.fn() },
  queueSnapshotRepository: { get: vi.fn(), put: vi.fn(), clear: vi.fn() },
}));

const entity = (id: string): TrackEntity => ({
  id: id as TrackEntity["id"],
  title: id,
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [],
  albumId: "album-1" as TrackEntity["albumId"],
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: `${id}.mp3`,
  state: TrackState.READY,
  duration: 120,
  format: {},
  playCount: 0,
  addedAt: 1,
});

const snapshotOf = (trackIds: string[]) => ({
  version: 1,
  queue: trackIds.map((trackId, i) => ({
    id: `item-${i}`,
    track: { kind: "library", trackId },
    source: { type: "manual" },
    addedAt: i,
  })),
  originalQueueOrder: trackIds.map((_, i) => `item-${i}`),
  currentIndex: 0,
  currentItemId: "item-0",
  isShuffled: false,
});

// Pinia only activates plugins once it is installed on an app; the persist
// plugin's afterHydrate is what starts the restore.
const createHydratedStore = () => {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({ render: () => null }).use(pinia);
  setActivePinia(pinia);
  registerPlaybackPort(createPlayerPlaybackPort());
  return useQueueStore();
};

describe("queue store isRestoring", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(trackRepository.findByIds).mockImplementation(async ids => ids.map(id => entity(id)));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports isRestoring while the persisted queue loads", async () => {
    let finishRead: (snapshot: unknown) => void = () => {};
    vi.mocked(queueSnapshotRepository.get).mockReturnValue(
      new Promise<unknown>((resolve) => {
        finishRead = resolve;
      }),
    );

    const store = createHydratedStore();

    expect(store.isRestoring).toBe(true);
    expect(store.currentTrack).toBeNull();

    finishRead(null);
    await vi.waitFor(() => expect(store.isRestoring).toBe(false));
  });

  it("clears isRestoring after a successful restore", async () => {
    vi.mocked(queueSnapshotRepository.get).mockResolvedValue(snapshotOf(["t1", "t2", "t3"]));

    const store = createHydratedStore();
    expect(store.isRestoring).toBe(true);

    await vi.waitFor(() => expect(store.size).toBe(3));
    expect(store.currentTrack?.id).toBe("t1");
    expect(store.isRestoring).toBe(false);
  });

  it("clears isRestoring when the restore fails", async () => {
    vi.mocked(queueSnapshotRepository.get).mockRejectedValue(new DbError("UNKNOWN", "database unavailable"));

    const store = createHydratedStore();
    expect(store.isRestoring).toBe(true);

    await vi.waitFor(() => expect(store.isRestoring).toBe(false));
    expect(store.isEmpty).toBe(true);
    expect(store.currentTrack).toBeNull();
  });
});
