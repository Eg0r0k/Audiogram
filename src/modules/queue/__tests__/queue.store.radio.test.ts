import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { errAsync, okAsync } from "neverthrow";
import { TrackSource, TrackState } from "@/db/entities";
import type { PlayerTrack, Track } from "@/modules/player/types";
import type { SourceTrackDTO } from "@/types/source-dto";
import { registerPlaybackPort, type PlaybackPort } from "../lib/playback-port";
import type { RadioSession } from "../lib/queue-radio";
import { useQueueStore } from "../store/queue.store";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock("../lib/shadow-pin", () => ({ shadowPinRemoteTracks: vi.fn() }));
vi.mock("@/db/repositories", () => ({ trackRepository: { findByIds: vi.fn() } }));

// A player that always plays: the queue's own bookkeeping is under test.
const port: PlaybackPort & { played: string[] } = {
  played: [],
  currentTrack: null,
  currentTime: 0,
  canSeek: true,
  isPlaybackIntended: true,
  presentTrack: vi.fn(),
  selectTrack: vi.fn(),
  playPlayerTrack: vi.fn(async (track: PlayerTrack) => { port.played.push(track.id); }),
  restartCurrent: vi.fn(async () => true),
  stop: vi.fn(),
  clearCurrentTrack: vi.fn(),
  seekTo: vi.fn(),
};

const dto = (n: number): SourceTrackDTO => ({ id: `ym:${n}` as SourceTrackDTO["id"], title: `Track ${n}`, availability: "full" });

const localTrack = (id: string): Track => ({
  kind: "library",
  id: id as Track["id"],
  title: id,
  artist: "Artist",
  artistIds: [],
  albumId: "album-1" as Track["albumId"],
  albumName: "Album",
  storagePath: `tracks/${id}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 120,
  isLiked: false,
});

const fakeSession = (first: SourceTrackDTO[], next: SourceTrackDTO[][] = []) => {
  const chains = [...next];
  const session: RadioSession & { next: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } = {
    station: "user:onyourwave",
    start: vi.fn(() => okAsync(first)),
    next: vi.fn(() => okAsync(chains.shift() ?? [])),
    stop: vi.fn(),
  };
  return session;
};

describe("queue.store — radio", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    port.played = [];
    vi.clearAllMocks();
    registerPlaybackPort(port);
  });

  it("startRadio replaces the queue with the first chain and plays it in order", async () => {
    const store = useQueueStore();
    await store.setQueue([localTrack("a"), localTrack("b")], 0, { type: "album", albumId: "album-1" as never }, { shuffled: true });
    store.repeatMode = "all";
    port.played = [];
    const session = fakeSession([dto(1), dto(2), dto(3), dto(4), dto(5)]);

    const result = await store.startRadio(session);

    expect(result.isOk()).toBe(true);
    expect(store.isRadio).toBe(true);
    expect(store.queue.map(item => item.track.id)).toEqual(["ym:1", "ym:2", "ym:3", "ym:4", "ym:5"]);
    expect(store.queue.every(item => item.source.type === "radio")).toBe(true);
    expect(store.currentIndex).toBe(0);
    expect(port.played).toEqual(["ym:1"]);
    // A station is the source's order: repeat and shuffle are off.
    expect(store.repeatMode).toBe("off");
    expect(store.isShuffled).toBe(false);
  });

  it("repeat and shuffle stay off while the station plays", async () => {
    const store = useQueueStore();
    await store.startRadio(fakeSession([dto(1), dto(2), dto(3), dto(4), dto(5)]));

    store.toggleRepeat();
    store.toggleShuffle();
    store.shuffle();

    expect(store.repeatMode).toBe("off");
    expect(store.isShuffled).toBe(false);
  });

  it("asks for the next chain once two entries are left and skips tracks it already holds", async () => {
    const store = useQueueStore();
    const session = fakeSession([dto(1), dto(2), dto(3), dto(4), dto(5)], [[dto(5), dto(6), dto(7)]]);
    await store.startRadio(session);
    expect(session.next).not.toHaveBeenCalled();

    await store.jumpTo(1);
    expect(session.next).not.toHaveBeenCalled();

    await store.jumpTo(2);
    await vi.waitFor(() => expect(session.next).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(store.size).toBe(7));

    expect(store.queue.map(item => item.track.id)).toEqual(["ym:1", "ym:2", "ym:3", "ym:4", "ym:5", "ym:6", "ym:7"]);
  });

  it("at the tail the station, not the local recommender, extends the queue", async () => {
    const store = useQueueStore();
    // The look-ahead on the last entry gets an empty chain; the tail asks again.
    const session = fakeSession([dto(1), dto(2), dto(3), dto(4)], [[], [dto(5)]]);
    await store.startRadio(session);
    await store.jumpTo(3);
    await vi.waitFor(() => expect(session.next).toHaveBeenCalledTimes(1));
    expect(store.size).toBe(4);

    await store.advance();

    expect(store.size).toBe(5);
    expect(store.currentIndex).toBe(4);
    expect(port.played.at(-1)).toBe("ym:5");
    // The tail asked once more, and playing the appended entry looked ahead again.
    await vi.waitFor(() => expect(session.next).toHaveBeenCalledTimes(3));
  });

  it("a chain the station cannot deliver leaves the queue as it is", async () => {
    const store = useQueueStore();
    const session = fakeSession([dto(1), dto(2)]);
    session.next.mockReturnValue(errAsync({ kind: "NETWORK", message: "offline" }));
    await store.startRadio(session);

    await store.jumpTo(1);
    await vi.waitFor(() => expect(session.next).toHaveBeenCalled());

    expect(store.size).toBe(2);
    expect(store.isRadio).toBe(true);
  });

  it("queuing something by hand ends the station", async () => {
    const store = useQueueStore();
    const session = fakeSession([dto(1), dto(2), dto(3)]);
    await store.startRadio(session);

    store.addToQueue(localTrack("mine"));

    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(store.isRadio).toBe(false);
    expect(store.queue.map(item => item.track.id)).toEqual(["ym:1", "ym:2", "ym:3", "mine"]);
  });

  it("playing a collection or clearing the queue ends the station too", async () => {
    const store = useQueueStore();
    const first = fakeSession([dto(1), dto(2), dto(3)]);
    await store.startRadio(first);

    await store.setQueue([localTrack("a")], 0, { type: "album", albumId: "album-1" as never });
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(store.isRadio).toBe(false);

    const second = fakeSession([dto(4), dto(5), dto(6)]);
    await store.startRadio(second);
    store.clear();
    expect(second.stop).toHaveBeenCalledTimes(1);
    expect(store.isRadio).toBe(false);
  });

  it("a second station replaces the first, which is stopped", async () => {
    const store = useQueueStore();
    const first = fakeSession([dto(1), dto(2), dto(3)]);
    await store.startRadio(first);

    const second = fakeSession([dto(4), dto(5), dto(6)]);
    await store.startRadio(second);

    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(store.queue.map(item => item.track.id)).toEqual(["ym:4", "ym:5", "ym:6"]);
  });

  it("a station that fails to start leaves the queue untouched and reports why", async () => {
    const store = useQueueStore();
    await store.setQueue([localTrack("a")], 0, { type: "album", albumId: "album-1" as never });
    const session = fakeSession([]);
    vi.mocked(session.start).mockReturnValue(errAsync({ kind: "FORBIDDEN", message: "premium only" }));

    const result = await store.startRadio(session);

    expect(result._unsafeUnwrapErr().kind).toBe("FORBIDDEN");
    expect(store.isRadio).toBe(false);
    expect(store.queue.map(item => item.track.id)).toEqual(["a"]);
    expect(session.stop).toHaveBeenCalledTimes(1);
  });
});
