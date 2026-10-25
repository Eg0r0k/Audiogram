/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { EphemeralTrack, Track } from "@/types/track";

vi.mock("@/db/repositories", () => ({
  trackRepository: { findByIds: vi.fn() },
}));

vi.mock("@/modules/recommendations/service/recommender.service", () => ({
  getRecommendations: vi.fn(() => Promise.resolve([])),
}));

const toggleLikeMock = vi.hoisted(() => vi.fn());
vi.mock("@/queries/track.queries", () => ({
  toggleTrackLikeAndSync: toggleLikeMock,
}));

const getCoverBlobMock = vi.hoisted(() => vi.fn());
vi.mock("@/queries/cover.queries", () => ({
  getCoversByOwners: async (type: string, ids: string[]) => {
    const found = await Promise.all(ids.map(async id => [id, await getCoverBlobMock(type, id)] as const));
    return new Map(found.filter(([, blob]) => blob).map(([id, blob]) => [id, { blob: blob as Blob, updatedAt: 1 }]));
  },
}));

import { usePlayerStore } from "../../store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { ARTWORK_WAIT_MS, useMediaSession } from "../useMediaSession";
import { coverCache } from "@/modules/covers/lib/cover-cache";

const createLibraryTrack = (id: string, albumId: string): Track => ({
  kind: "library",
  id: id as Track["id"],
  title: `Track ${id}`,
  artist: "Artist",
  artistIds: [],
  albumId: albumId as Track["albumId"],
  albumName: "Album",
  storagePath: `tracks/${id}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
});

const createEphemeralTrack = (id: string, extra: { cover?: string; duration?: number } = {}): EphemeralTrack => ({
  kind: "ephemeral",
  id,
  title: `Stream ${id}`,
  artist: "Artist",
  source: { type: "url", url: `https://stream.example/${id}` },
  ...extra,
});

const coverResponse = (body: string) =>
  ({ ok: true, status: 200, blob: async () => new Blob([body]) }) as unknown as Response;

const missingResponse = () =>
  ({ ok: false, status: 404, blob: async () => new Blob([]) }) as unknown as Response;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Past the visible-page encode delay, so a cover that was going to be pushed has been.
const ENCODE_SETTLE_MS = 600;

const bridge = {
  setMetadata: vi.fn(),
  setPlaybackState: vi.fn(),
  release: vi.fn(),
};

const dispatchAndroidAction = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent("audiogram-media-action", { detail }));
};

const Host = defineComponent({
  setup() {
    useMediaSession();
    return () => h("div");
  },
});

const mountSession = () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  return render(Host, { global: { plugins: [pinia, i18n, VueQueryPlugin] } });
};

describe("useMediaSession (android bridge)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).AudiogramMediaSession = bridge;
    // jsdom has no Blob URL support; the cover pipeline needs a stub.
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    getCoverBlobMock.mockResolvedValue(null);
    // The cover cache is a process singleton: forget what earlier tests saw.
    coverCache.invalidateAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("never reports paused to the notification while a track switch is loading", async () => {
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");
    player.playbackState = { kind: "playing" };
    await vi.waitFor(() => expect(bridge.setPlaybackState.mock.lastCall?.[0]).toBe(true));
    bridge.setPlaybackState.mockClear();

    player.playbackState = { kind: "loading", requestId: 0 };
    player.currentTrack = createLibraryTrack("t2", "album-a");
    await Promise.resolve();
    player.playbackState = { kind: "playing" };
    await vi.waitFor(() => expect(bridge.setPlaybackState).toHaveBeenCalled());

    const reported = bridge.setPlaybackState.mock.calls.map(call => call[0]);
    expect(reported).not.toContain(false);

    player.playbackState = { kind: "paused" };
    await vi.waitFor(() => expect(bridge.setPlaybackState.mock.lastCall?.[0]).toBe(false));
  });

  it("re-reports the position only when it drifts from what the system extrapolates", async () => {
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");
    player.duration = 300;
    player.playbackState = { kind: "playing" };
    await vi.waitFor(() => expect(bridge.setPlaybackState.mock.lastCall?.[0]).toBe(true));
    bridge.setPlaybackState.mockClear();

    // Ordinary progress: the notification is already moving on its own.
    player.currentTime = 0.5;
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(bridge.setPlaybackState).not.toHaveBeenCalled();

    // A jump (in-app seek, stall recovery) is what needs a fresh report.
    player.currentTime = 42;
    await vi.waitFor(() => expect(bridge.setPlaybackState).toHaveBeenCalledTimes(1));
    expect(bridge.setPlaybackState.mock.lastCall?.[1]).toBe(42_000);
  });

  it("reports the seek target instead of the stale store position", async () => {
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");
    // Stand in for a loaded engine: the bridge only forwards a seek when the
    // store says it can seek. The store's own seekTo no-ops without an engine.
    Object.defineProperty(player, "canSeek", { get: () => true, configurable: true });
    player.duration = 200;
    player.currentTime = 30;

    bridge.setPlaybackState.mockClear();
    dispatchAndroidAction({ action: "seekto", positionMs: 150_000 });

    // The store's currentTime only updates on the next engine timeupdate; the
    // bridge must be told the seek target, or the lock-screen scrubber snaps
    // back to the old position for a second. Pushes are coalesced into the
    // next task, so the target arrives there rather than synchronously.
    await vi.waitFor(() => {
      const [, positionMs] = bridge.setPlaybackState.mock.lastCall!;
      expect(positionMs).toBe(150_000);
    });
  });

  it("cycles repeat mode from the notification and reports it back", async () => {
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");

    bridge.setPlaybackState.mockClear();
    dispatchAndroidAction({ action: "repeat" });

    expect(useQueueStore().repeatMode).toBe("all");
    await vi.waitFor(() => {
      const call = bridge.setPlaybackState.mock.lastCall!;
      expect(call[5]).toBe("all");
    });
  });

  it("toggles the current library track's like from the notification", async () => {
    toggleLikeMock.mockImplementation(async (_client: unknown, track: Track) => ({
      ...track,
      isLiked: !track.isLiked,
    }));
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");

    dispatchAndroidAction({ action: "like" });

    await vi.waitFor(() => {
      expect(player.currentTrack?.kind === "library" && player.currentTrack.isLiked).toBe(true);
    });
    await vi.waitFor(() => {
      const call = bridge.setPlaybackState.mock.lastCall!;
      // liked / canLike flags reach the bridge so the heart icon can fill in.
      expect(call[6]).toBe(true);
      expect(call[7]).toBe(true);
    });
  });

  it("pushes a new track's metadata together with its artwork, never text first", async () => {
    let resolveCoverB!: (blob: Blob) => void;
    getCoverBlobMock.mockImplementation(async (_type: string, id: string) => {
      if (id === "album-a") return new Blob(["cover-a"]);
      return new Promise<Blob>((resolve) => {
        resolveCoverB = resolve;
      });
    });

    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");

    await vi.waitFor(() => {
      const call = bridge.setMetadata.mock.lastCall!;
      expect(call[0]).toBe("Track t1");
      expect(call[3]).not.toBe("");
    });

    // Album B's cover is still loading: nothing goes out for t2 yet — a
    // text-only push would pin the placeholder on MIUI's notification.
    bridge.setMetadata.mockClear();
    player.currentTrack = createLibraryTrack("t2", "album-b");
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(bridge.setMetadata).not.toHaveBeenCalled();

    resolveCoverB(new Blob(["cover-b"]));
    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    });
    for (const call of bridge.setMetadata.mock.calls) {
      expect(call[0]).toBe("Track t2");
      expect(call[3]).not.toBe("");
    }
  });

  it("pushes the metadata without artwork once the artwork wait runs out", async () => {
    vi.useFakeTimers();
    try {
      getCoverBlobMock.mockImplementation(() => new Promise<Blob>(() => {}));
      mountSession();
      const player = usePlayerStore();
      player.currentTrack = createLibraryTrack("t1", "album-a");

      await vi.advanceTimersByTimeAsync(ARTWORK_WAIT_MS - 100);
      expect(bridge.setMetadata).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      expect(bridge.setMetadata).toHaveBeenCalledTimes(1);
      expect(bridge.setMetadata.mock.lastCall![0]).toBe("Track t1");
      expect(bridge.setMetadata.mock.lastCall![3]).toBe("");
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("pushes a track without a cover right away", async () => {
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-none");

    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    });
    expect(bridge.setMetadata.mock.lastCall![0]).toBe("Track t1");
    expect(bridge.setMetadata.mock.lastCall![3]).toBe("");
  });

  it("sends the track's own duration with its metadata push", async () => {
    mountSession();
    const player = usePlayerStore();
    // Right after a skip the store can still hold the previous load's duration.
    player.duration = 31;
    player.currentTrack = createLibraryTrack("t1", "album-none");

    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    });
    for (const call of bridge.setMetadata.mock.calls) {
      expect(call[0]).toBe("Track t1");
      expect(call[4]).toBe(200_000);
    }
  });

  it("re-pushes metadata with the media's duration for a track that has none of its own", async () => {
    vi.stubGlobal("fetch", vi.fn());
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createEphemeralTrack("e1");

    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    });
    expect(bridge.setMetadata.mock.lastCall![4]).toBe(0);

    bridge.setMetadata.mockClear();
    player.duration = 245.5;
    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalledTimes(1);
    });
    expect(bridge.setMetadata.mock.lastCall![0]).toBe("Stream e1");
    expect(bridge.setMetadata.mock.lastCall![4]).toBe(245_500);

    // A refinement within a second is not worth another metadata push.
    bridge.setMetadata.mockClear();
    bridge.setPlaybackState.mockClear();
    player.duration = 246;
    await vi.waitFor(() => {
      expect(bridge.setPlaybackState).toHaveBeenCalled();
    });
    expect(bridge.setMetadata).not.toHaveBeenCalled();
  });

  it("does not re-push metadata when the media reports a duration for a track that has its own", async () => {
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-none");
    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    });
    bridge.setMetadata.mockClear();
    bridge.setPlaybackState.mockClear();

    player.duration = 263;
    await vi.waitFor(() => {
      expect(bridge.setPlaybackState).toHaveBeenCalled();
    });
    expect(bridge.setMetadata).not.toHaveBeenCalled();
  });

  it("pushes a hidden page's new track with its artwork in the first push even if OffscreenCanvas encoding never finishes", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 900, close: vi.fn() })));
    vi.stubGlobal("OffscreenCanvas", class {
      getContext() {
        return { drawImage: vi.fn() };
      }

      convertToBlob() {
        return new Promise<Blob>(() => {});
      }
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as any);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,Q0FOVkFT");
    getCoverBlobMock.mockResolvedValue(new Blob(["cover-a"]));

    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createLibraryTrack("t1", "album-a");

    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    }, { timeout: ARTWORK_WAIT_MS + 1000 });
    const [title, , , artwork] = bridge.setMetadata.mock.calls[0]!;
    expect(title).toBe("Track t1");
    expect(artwork).toBe("Q0FOVkFT");
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 384);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.85);
  });

  it("pushes an ephemeral track's cover fetched from its URL", async () => {
    const fetchMock = vi.fn(async () => coverResponse("stream-cover"));
    vi.stubGlobal("fetch", fetchMock);
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createEphemeralTrack("e1", { cover: "https://avatars.example/e1" });

    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://avatars.example/e1",
      expect.objectContaining({ signal: expect.anything() }),
    );
    for (const call of bridge.setMetadata.mock.calls) {
      expect(call[0]).toBe("Stream e1");
      expect(call[3]).toBe(btoa("stream-cover"));
    }
  });

  it("pushes an ephemeral track without artwork right away when its cover cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/missing")) return missingResponse();
      throw new TypeError("Failed to fetch");
    }));
    mountSession();
    const player = usePlayerStore();

    player.currentTrack = createEphemeralTrack("e1", { cover: "https://covers.example/missing" });
    await vi.waitFor(() => {
      expect(bridge.setMetadata.mock.lastCall?.[0]).toBe("Stream e1");
    }, { timeout: ARTWORK_WAIT_MS / 2 });
    expect(bridge.setMetadata.mock.lastCall![3]).toBe("");

    player.currentTrack = createEphemeralTrack("e2", { cover: "https://covers.example/offline" });
    await vi.waitFor(() => {
      expect(bridge.setMetadata.mock.lastCall?.[0]).toBe("Stream e2");
    }, { timeout: ARTWORK_WAIT_MS / 2 });
    expect(bridge.setMetadata.mock.lastCall![3]).toBe("");
  });

  it("never pushes an ephemeral cover that arrives after the track changed", async () => {
    const cover1 = deferred<Response>();
    const cover2 = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.endsWith("/1") ? cover1.promise : cover2.promise)));
    mountSession();
    const player = usePlayerStore();

    player.currentTrack = createEphemeralTrack("e1", { cover: "https://covers.example/1" });
    await sleep(50);
    player.currentTrack = createEphemeralTrack("e2", { cover: "https://covers.example/2" });
    await sleep(50);

    cover1.resolve(coverResponse("cover-1"));
    await sleep(ENCODE_SETTLE_MS);
    expect(bridge.setMetadata.mock.calls.map(call => call[3])).not.toContain(btoa("cover-1"));

    cover2.resolve(coverResponse("cover-2"));
    await vi.waitFor(() => {
      expect(bridge.setMetadata.mock.lastCall?.[3]).toBe(btoa("cover-2"));
    });
    expect(bridge.setMetadata.mock.lastCall![0]).toBe("Stream e2");
    expect(bridge.setMetadata.mock.calls.map(call => call[3])).not.toContain(btoa("cover-1"));
  });

  it("pushes an ephemeral track without a cover URL right away without artwork", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mountSession();
    const player = usePlayerStore();
    player.currentTrack = createEphemeralTrack("e1");

    await vi.waitFor(() => {
      expect(bridge.setMetadata).toHaveBeenCalled();
    }, { timeout: ARTWORK_WAIT_MS / 2 });
    expect(bridge.setMetadata.mock.lastCall![0]).toBe("Stream e1");
    expect(bridge.setMetadata.mock.lastCall![3]).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
