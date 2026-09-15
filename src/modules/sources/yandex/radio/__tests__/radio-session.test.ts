import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import { useEventBus } from "@vueuse/core";
import { listenEndedEvent, trackChangedEvent } from "@/modules/player/lib/player-events";
import type { PlayerTrack } from "@/modules/player/types";
import { TrackSource, TrackState } from "@/db/entities";
import type { RadioSession } from "@/modules/queue/lib/queue-radio";
import tracksFixture from "../../__fixtures__/tracks-batch.json";
import derived from "../../__fixtures__/derived-edge-cases.json";
import type { YmStationTracks, YmTrack } from "../../api/types";
import { createYmRadioSession, type RadioDeps } from "../radio-session";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

const recorded = tracksFixture.result as YmTrack[];

// The rotor envelope (sequence/batchId) could not be recorded without an
// account; the tracks inside it are the recorded ones.
const chain = (batchId: string, tracks: YmTrack[]): YmStationTracks => ({
  id: { type: "user", tag: "onyourwave" },
  sequence: tracks.map(track => ({ type: "track", track, liked: false })),
  batchId,
});

const playerTrack = (id: string): PlayerTrack => ({
  kind: "library",
  id: id as PlayerTrack["id"],
  title: "t",
  artist: "a",
  artistIds: [],
  albumId: "" as never,
  albumName: "",
  storagePath: "",
  source: TrackSource.REMOTE_YM,
  state: TrackState.READY,
  duration: 0,
  isLiked: false,
});

const NOW = new Date("2026-09-15T12:00:00.000Z");

const makeDeps = () => {
  const deps: RadioDeps = {
    stationTracks: vi.fn(() => okAsync(chain("batch-1", recorded.slice(0, 2)))),
    stationFeedback: vi.fn(() => okAsync("ok")),
    prefetch: vi.fn(),
    now: () => NOW,
  };
  return deps;
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const feedbacks = (deps: RadioDeps) =>
  vi.mocked(deps.stationFeedback).mock.calls.map(([station, batchId, form]) => ({ station, batchId, form }));

describe("createYmRadioSession", () => {
  let session: RadioSession | null = null;

  beforeEach(() => {
    session = null;
  });

  afterEach(() => {
    session?.stop();
  });

  it("start fetches the first chain, reports radioStarted under its batch and warms two tracks", async () => {
    const deps = makeDeps();
    session = createYmRadioSession("user:onyourwave", deps);

    const result = await session.start();

    expect(result._unsafeUnwrap().map(dto => dto.id)).toEqual(["ym:40144", "ym:38633756"]);
    expect(deps.stationTracks).toHaveBeenCalledWith("user:onyourwave", undefined);
    await flush();
    expect(feedbacks(deps)).toEqual([
      { station: "user:onyourwave", batchId: "batch-1", form: { type: "radioStarted", timestamp: NOW.toISOString() } },
    ]);
    expect(deps.prefetch).toHaveBeenCalledTimes(2);
    expect(deps.prefetch).toHaveBeenCalledWith("ym:40144");
  });

  it("next continues the chain from the last track Yandex handed over", async () => {
    const deps = makeDeps();
    vi.mocked(deps.stationTracks)
      .mockReturnValueOnce(okAsync(chain("batch-1", recorded.slice(0, 2))))
      .mockReturnValueOnce(okAsync(chain("batch-2", recorded.slice(2, 3))));
    session = createYmRadioSession("user:onyourwave", deps);
    await session.start();

    const more = await session.next();

    expect(more._unsafeUnwrap().map(dto => dto.id)).toEqual(["ym:1"]);
    expect(deps.stationTracks).toHaveBeenLastCalledWith("user:onyourwave", "38633756");
  });

  it("drops a locked track before it can reach the queue", async () => {
    const deps = makeDeps();
    vi.mocked(deps.stationTracks).mockReturnValue(
      okAsync(chain("batch-1", [derived.lockedTrack as YmTrack, recorded[1]])),
    );
    session = createYmRadioSession("user:onyourwave", deps);

    const result = await session.start();

    expect(result._unsafeUnwrap().map(dto => dto.id)).toEqual(["ym:38633756"]);
  });

  it("reports trackStarted, then trackFinished or skip, under the track's batch", async () => {
    const deps = makeDeps();
    vi.mocked(deps.stationTracks)
      .mockReturnValueOnce(okAsync(chain("batch-1", recorded.slice(0, 2))))
      .mockReturnValueOnce(okAsync(chain("batch-2", recorded.slice(2, 3))));
    session = createYmRadioSession("user:onyourwave", deps);
    await session.start();
    await session.next();
    await flush();
    vi.mocked(deps.stationFeedback).mockClear();

    useEventBus(trackChangedEvent).emit(playerTrack("ym:40144"));
    useEventBus(listenEndedEvent).emit({ track: playerTrack("ym:40144"), seconds: 263.4, reason: "completed" });
    useEventBus(trackChangedEvent).emit(playerTrack("ym:1"));
    useEventBus(listenEndedEvent).emit({ track: playerTrack("ym:1"), seconds: 12.6, reason: "skipped" });
    await flush();

    expect(feedbacks(deps).map(({ batchId, form }) => [batchId, form.type, form.trackId, form.totalPlayedSeconds])).toEqual([
      ["batch-1", "trackStarted", "40144", undefined],
      ["batch-1", "trackFinished", "40144", "263"],
      ["batch-2", "trackStarted", "1", undefined],
      ["batch-2", "skip", "1", "13"],
    ]);
  });

  it("ignores tracks that did not come from the station", async () => {
    const deps = makeDeps();
    session = createYmRadioSession("user:onyourwave", deps);
    await session.start();
    await flush();
    vi.mocked(deps.stationFeedback).mockClear();

    useEventBus(trackChangedEvent).emit(playerTrack("ym:999"));
    useEventBus(trackChangedEvent).emit(playerTrack("nd:s1"));
    useEventBus(listenEndedEvent).emit({ track: playerTrack("local-1"), seconds: 5, reason: "skipped" });
    await flush();

    expect(deps.stationFeedback).not.toHaveBeenCalled();
  });

  it("a failed feedback is retried on the next send and never breaks the session", async () => {
    const deps = makeDeps();
    vi.mocked(deps.stationFeedback)
      .mockReturnValueOnce(errAsync({ kind: "NETWORK", message: "offline" }))
      .mockReturnValue(okAsync("ok"));
    session = createYmRadioSession("user:onyourwave", deps);
    await session.start();
    await flush();
    expect(feedbacks(deps).map(f => f.form.type)).toEqual(["radioStarted"]);

    useEventBus(trackChangedEvent).emit(playerTrack("ym:40144"));
    await flush();

    // radioStarted went again before trackStarted: order is kept.
    expect(feedbacks(deps).map(f => f.form.type)).toEqual(["radioStarted", "radioStarted", "trackStarted"]);
    expect((await session.next()).isOk()).toBe(true);
  });

  it("gives up on a feedback after three failed attempts", async () => {
    const deps = makeDeps();
    vi.mocked(deps.stationFeedback).mockReturnValue(errAsync({ kind: "NETWORK", message: "offline" }));
    session = createYmRadioSession("user:onyourwave", deps);
    await session.start();
    await flush();

    useEventBus(trackChangedEvent).emit(playerTrack("ym:40144"));
    await flush();
    useEventBus(trackChangedEvent).emit(playerTrack("ym:38633756"));
    await flush();
    vi.mocked(deps.stationFeedback).mockClear();
    useEventBus(listenEndedEvent).emit({ track: playerTrack("ym:38633756"), seconds: 1, reason: "skipped" });
    await flush();

    // radioStarted has failed three times and is dropped; the queue moves on.
    expect(feedbacks(deps)[0].form.type).toBe("trackStarted");
  });

  it("stop ends the feedback and refuses further chains", async () => {
    const deps = makeDeps();
    session = createYmRadioSession("user:onyourwave", deps);
    await session.start();
    await flush();
    vi.mocked(deps.stationFeedback).mockClear();

    session.stop();
    useEventBus(trackChangedEvent).emit(playerTrack("ym:40144"));
    await flush();

    expect(deps.stationFeedback).not.toHaveBeenCalled();
    expect((await session.next())._unsafeUnwrapErr().kind).toBe("CANCELLED");
    expect(deps.stationTracks).toHaveBeenCalledTimes(1);
  });

  it("a station Yandex cannot serve fails start without feedback", async () => {
    const deps = makeDeps();
    vi.mocked(deps.stationTracks).mockReturnValue(errAsync({ kind: "FORBIDDEN", message: "premium only" }));
    session = createYmRadioSession("user:onyourwave", deps);

    const result = await session.start();
    await flush();

    expect(result._unsafeUnwrapErr().kind).toBe("FORBIDDEN");
    expect(deps.stationFeedback).not.toHaveBeenCalled();
  });
});
