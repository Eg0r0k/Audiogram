import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A running AudioContext renders silence while nothing plays: on Android that
// kept the renderer's audio thread at a quarter of a core for as long as the
// app sat paused, in the background too.

type Listener = (payload: unknown) => void;

const lyra = vi.hoisted(() => ({ instances: [] as Array<{ emit: (event: string, payload: unknown) => void; freezeAudioContext: ReturnType<typeof vi.fn> }> }));

vi.mock("lyra-audio", () => {
  class Player {
    private listeners = new Map<string, Listener[]>();
    freezeAudioContext = vi.fn(() => Promise.resolve());
    constructor() { lyra.instances.push(this); }
    on(event: string, listener: Listener) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    }
    emit(event: string, payload: unknown) {
      for (const listener of this.listeners.get(event) ?? []) listener(payload);
    }
    setVolume() {}
    setMuted() {}
    setPlaybackRate() {}
    dispose() { return Promise.resolve(); }
  }
  return { Player };
});

import { createPlaybackEngine, IDLE_SUSPEND_MS } from "../playback-engine";

const handlers = {
  onStateChange: vi.fn(), onPause: vi.fn(), onEnded: vi.fn(), onTimeUpdate: vi.fn(), onSeek: vi.fn(),
  onDuration: vi.fn(), onCanPlay: vi.fn(), onVolume: vi.fn(), onRate: vi.fn(), onError: vi.fn(),
};

const createEngine = () => {
  const engine = createPlaybackEngine({
    volume: 1, muted: false, playbackRate: 1,
    loudnessNormalization: { enabled: false, targetLufs: -16, preventClipping: true },
    handlers,
  });
  const player = lyra.instances.at(-1)!;
  const moveTo = (to: string, from = "playing") => player.emit("statechange", { from, to });
  return { engine, player, moveTo };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  lyra.instances.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("playback engine idle suspend", () => {
  it("suspends the audio context once playback has stayed paused for the idle window", () => {
    const { player, moveTo } = createEngine();

    moveTo("paused");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS - 1);
    expect(player.freezeAudioContext).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(player.freezeAudioContext).toHaveBeenCalledTimes(1);
  });

  it("keeps the context running when playback resumes inside the window", () => {
    const { player, moveTo } = createEngine();

    moveTo("paused");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS / 2);
    moveTo("playing", "paused");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS * 3);

    expect(player.freezeAudioContext).not.toHaveBeenCalled();
  });

  it("does not suspend while a track is loading or buffering", () => {
    const { player, moveTo } = createEngine();

    moveTo("paused");
    moveTo("loading", "paused");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS * 2);
    moveTo("buffering", "loading");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS * 2);

    expect(player.freezeAudioContext).not.toHaveBeenCalled();
  });

  it("counts the window from the latest pause, not the first", () => {
    const { player, moveTo } = createEngine();

    moveTo("paused");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS - 100);
    moveTo("playing", "paused");
    moveTo("paused");
    vi.advanceTimersByTime(IDLE_SUSPEND_MS - 100);

    expect(player.freezeAudioContext).not.toHaveBeenCalled();
  });

  it("suspends after a stop or a failed load as well", () => {
    const stopped = createEngine();
    stopped.moveTo("ready");
    const failed = createEngine();
    failed.moveTo("error", "loading");

    vi.advanceTimersByTime(IDLE_SUSPEND_MS);

    expect(stopped.player.freezeAudioContext).toHaveBeenCalledTimes(1);
    expect(failed.player.freezeAudioContext).toHaveBeenCalledTimes(1);
  });

  it("never touches the context of a disposed engine", async () => {
    const { engine, player, moveTo } = createEngine();

    moveTo("paused");
    await engine.dispose();
    vi.advanceTimersByTime(IDLE_SUSPEND_MS * 2);

    expect(player.freezeAudioContext).not.toHaveBeenCalled();
  });
});
