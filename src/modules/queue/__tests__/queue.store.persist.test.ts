import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queueSnapshotRepository, trackRepository } from "@/db/repositories";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { createPlayerPlaybackPort } from "@/modules/player/lib/queue-playback-port";
import type { Track } from "@/modules/player/types";
import { registerPlaybackPort } from "../lib/playback-port";
import { useQueueStore } from "../store/queue.store";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const stored = vi.hoisted(() => ({ body: null as unknown }));
vi.mock("@/db/repositories", () => ({
  trackRepository: { findByIds: vi.fn() },
  queueSnapshotRepository: {
    get: vi.fn(async () => ({ isErr: () => false, isOk: () => true, value: stored.body })),
    put: vi.fn(async (body: unknown) => {
      stored.body = structuredClone(body);
      return { isErr: () => false, isOk: () => true, value: undefined };
    }),
    clear: vi.fn(async () => {
      stored.body = null;
      return { isErr: () => false, isOk: () => true, value: undefined };
    }),
  },
}));

const track = (i: number): Track => ({
  kind: "library",
  id: `local-track-${i}` as Track["id"],
  title: `Track ${i}`,
  artist: "Artist",
  artistIds: [],
  albumId: "album-1" as Track["albumId"],
  albumName: "Album",
  storagePath: `tracks/${i}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 120,
  isLiked: false,
});

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

// Pinia only activates plugins once it is installed on an app.
const hydratedStore = () => {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({ render: () => null }).use(pinia);
  setActivePinia(pinia);
  registerPlaybackPort(createPlayerPlaybackPort());
  const store = useQueueStore();
  vi.spyOn(usePlayerStore(), "playPlayerTrack").mockResolvedValue(undefined);
  return store;
};

// The persist plugin writes from a pre-flush watcher and debounces the
// write; hiding the page flushes it.
const flushWrites = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  window.dispatchEvent(new Event("pagehide"));
  await new Promise(resolve => setTimeout(resolve, 0));
};

const queueKeysSize = () => Object.keys(localStorage)
  .filter(key => key.startsWith("audiogram-queue"))
  .reduce((sum, key) => sum + key.length + (localStorage.getItem(key)?.length ?? 0), 0);

describe("queue persistence at library scale", () => {
  beforeEach(() => {
    localStorage.clear();
    stored.body = null;
    vi.clearAllMocks();
    vi.mocked(trackRepository.findByIds).mockImplementation(async ids => ok(ids.map(id => entity(id))));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // "Play all" on 10k tracks wrote 1.85 MB to localStorage on every skip.
  it("a skip writes the current entry, not the whole queue", async () => {
    const store = hydratedStore();
    await store.setQueue(Array.from({ length: 10_000 }, (_, i) => track(i)), 0, { type: "manual" });
    await flushWrites();

    const setItem = vi.spyOn(localStorage, "setItem");
    await store.jumpTo(1);
    await flushWrites();

    const written = setItem.mock.calls.reduce((sum, [, value]) => sum + value.length, 0);
    expect(written).toBeLessThan(1024);
    expect(queueSnapshotRepository.put).toHaveBeenCalledTimes(1);
  });

  // Above ~27k tracks the snapshot outgrew the localStorage quota and every
  // queue change threw QuotaExceededError.
  it("keeps a 30k-track queue out of localStorage and restores it", async () => {
    const store = hydratedStore();
    await store.setQueue(Array.from({ length: 30_000 }, (_, i) => track(i)), 5, { type: "manual" });
    await flushWrites();

    expect(queueKeysSize()).toBeLessThan(1024);

    const restored = hydratedStore();
    await vi.waitFor(() => expect(restored.size).toBe(30_000));
    expect(restored.currentIndex).toBe(5);
    expect(restored.currentTrack?.id).toBe("local-track-5");
  });
});
