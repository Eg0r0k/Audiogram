import { defineComponent, nextTick, reactive } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalHotKeys } from "../composables/useGlobalHotkeys";
import { HOLD_DELAY_MS, SEEK_REPEAT_MS, SEEK_STEP, VOLUME_REPEAT_MS } from "../constants";

interface FakeTrack {
  kind: "library";
  id: string;
}

// The engine moves its position synchronously on seek; the store's
// currentTime only follows on the next timeupdate.
const engine = { currentTime: 0 };
const player = reactive({
  volume: 1,
  currentTime: 0,
  duration: 100 as number | null,
  canSeek: true,
  currentTrack: { kind: "library", id: "a" } as FakeTrack | null,
  player: engine as { currentTime: number } | null,
  setVolume: vi.fn((value: number) => {
    player.volume = value;
  }),
  seekTo: vi.fn((seconds: number) => {
    engine.currentTime = seconds;
  }),
  toggleMute: vi.fn(),
});
const queue = { toggleRepeat: vi.fn(), toggleShuffle: vi.fn(), next: vi.fn(), previous: vi.fn() };
const rightPanel = { isOpen: false, view: null as string | null, openQueue: vi.fn(), close: vi.fn() };

vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => player }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));
vi.mock("@/modules/right-panel/store/right-panel.store", () => ({ useRightPanelStore: () => rightPanel }));
vi.mock("@/modules/search/composables/useSearch", async () => {
  const { ref } = await import("vue");
  return { useSearch: () => ({ openSearch: vi.fn(), isSearchOpen: ref(false) }) };
});

const keydown = async (key: string, init: KeyboardEventInit = {}) => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
  await nextTick();
};

const keyup = async (key: string, init: KeyboardEventInit = {}) => {
  window.dispatchEvent(new KeyboardEvent("keyup", { key, ...init }));
  await nextTick();
};

const press = async (key: string) => {
  await keydown(key);
  await keyup(key);
};

const holdShiftArrow = async (arrow: "ArrowLeft" | "ArrowRight") => {
  await keydown("Shift", { shiftKey: true });
  await keydown(arrow, { shiftKey: true });
};

const releaseShiftArrow = async (arrow: "ArrowLeft" | "ArrowRight") => {
  await keyup(arrow, { shiftKey: true });
  await keyup("Shift");
};

const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await nextTick();
};

const seeks = () => player.seekTo.mock.calls.map(([seconds]) => seconds);

let wrapper: VueWrapper | null = null;

const mountHotkeys = () => {
  wrapper = mount(defineComponent({
    setup: () => {
      useGlobalHotKeys();
      return () => null;
    },
  }));
};

const toggles = () => ({
  repeat: queue.toggleRepeat.mock.calls.length,
  shuffle: queue.toggleShuffle.mock.calls.length,
  mute: player.toggleMute.mock.calls.length,
  queuePanel: rightPanel.openQueue.mock.calls.length,
});

describe("useGlobalHotKeys", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.clearAllMocks();
    Object.assign(player, {
      volume: 1,
      currentTime: 0,
      duration: 100,
      canSeek: true,
      currentTrack: { kind: "library", id: "a" },
      player: engine,
    });
    engine.currentTime = 0;
    mountHotkeys();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
  });

  describe("single-letter toggles", () => {
    it("fire on a plain press", async () => {
      await press("r");
      await press("s");
      await press("m");
      await press("q");

      expect(toggles()).toEqual({ repeat: 1, shuffle: 1, mute: 1, queuePanel: 1 });
    });

    //
    // Ctrl+R is the reload. The toggle used to fire on it first, the
    // debounced store flushed the flipped mode on pagehide, and every reload
    // turned repeat-all into repeat-one. Ctrl+S, Ctrl+M, Cmd+Q are the same
    // story with the browser's or the OS's own chords.
    //
    it.each([
      ["Control", "ctrlKey"],
      ["Meta", "metaKey"],
      ["Alt", "altKey"],
    ] as const)("leave a %s chord to the browser", async (modifier, flag) => {
      await keydown(modifier, { [flag]: true });
      for (const key of ["r", "s", "m", "q"]) {
        await keydown(key, { [flag]: true });
        await keyup(key, { [flag]: true });
      }
      await keyup(modifier);

      expect(toggles()).toEqual({ repeat: 0, shuffle: 0, mute: 0, queuePanel: 0 });
    });
  });

  describe("volume with the up and down arrows", () => {
    const volumes = () => player.setVolume.mock.calls.map(([value]) => value);

    it("keeps the volume within 0..1 at either end of the arrow keys", async () => {
      player.volume = 1;
      await press("ArrowUp");
      expect(player.volume).toBe(1);

      player.volume = 0;
      await press("ArrowDown");
      expect(player.volume).toBe(0);
    });

    it("steps once on a press and keeps stepping while held, until released", async () => {
      player.volume = 0.5;

      await keydown("ArrowUp");
      expect(volumes()).toEqual([0.55]);

      await advance(HOLD_DELAY_MS);
      await advance(VOLUME_REPEAT_MS * 2);
      expect(volumes()).toEqual([0.55, 0.6, 0.65, 0.7]);

      await keyup("ArrowUp");
      await advance(VOLUME_REPEAT_MS * 5);
      expect(volumes()).toEqual([0.55, 0.6, 0.65, 0.7]);
    });

    it("stops at full volume and at silence instead of writing the bound again", async () => {
      player.volume = 0.9;
      await keydown("ArrowUp");
      await advance(HOLD_DELAY_MS + VOLUME_REPEAT_MS * 10);
      await keyup("ArrowUp");
      expect(volumes()).toEqual([0.95, 1]);

      player.setVolume.mockClear();
      player.volume = 0.1;
      await keydown("ArrowDown");
      await advance(HOLD_DELAY_MS + VOLUME_REPEAT_MS * 10);
      await keyup("ArrowDown");
      expect(volumes()).toEqual([0.05, 0]);
    });

    it("lands on whole percents, not on float drift", async () => {
      player.volume = 0.1;
      await keydown("ArrowUp");
      await advance(HOLD_DELAY_MS);
      await keyup("ArrowUp");

      expect(volumes()).toEqual([0.15, 0.2]);
    });
  });

  describe("seek with Shift + arrows", () => {
    it("steps once on a press, from where the engine is rather than the store's last timeupdate", async () => {
      engine.currentTime = 40;
      player.currentTime = 39.8;

      await holdShiftArrow("ArrowRight");
      await releaseShiftArrow("ArrowRight");

      expect(seeks()).toEqual([40 + SEEK_STEP]);
    });

    it("adds up presses that land before the next timeupdate", async () => {
      engine.currentTime = 40;
      player.currentTime = 40;

      await holdShiftArrow("ArrowRight");
      await releaseShiftArrow("ArrowRight");
      await holdShiftArrow("ArrowRight");
      await releaseShiftArrow("ArrowRight");

      expect(seeks()).toEqual([40 + SEEK_STEP, 40 + 2 * SEEK_STEP]);
    });

    it("keeps stepping while held, after the hold delay, and stops on release", async () => {
      engine.currentTime = 10;

      await holdShiftArrow("ArrowRight");
      await advance(HOLD_DELAY_MS - 1);
      expect(seeks()).toEqual([15]);

      await advance(1);
      expect(seeks()).toEqual([15, 20]);

      await advance(SEEK_REPEAT_MS * 2);
      expect(seeks()).toEqual([15, 20, 25, 30]);

      await releaseShiftArrow("ArrowRight");
      await advance(SEEK_REPEAT_MS * 5);
      expect(seeks()).toEqual([15, 20, 25, 30]);
    });

    it("stops when Shift is let go while the arrow is still down", async () => {
      engine.currentTime = 10;

      await holdShiftArrow("ArrowRight");
      await keyup("Shift");
      await advance(HOLD_DELAY_MS + SEEK_REPEAT_MS * 3);

      expect(seeks()).toEqual([15]);
    });

    it("stops when the window loses focus mid-hold", async () => {
      engine.currentTime = 10;

      await holdShiftArrow("ArrowRight");
      window.dispatchEvent(new Event("blur"));
      await nextTick();
      await advance(HOLD_DELAY_MS + SEEK_REPEAT_MS * 3);

      expect(seeks()).toEqual([15]);
    });

    it("lands on the end of the track and stops there, so the hold never runs into the next one", async () => {
      engine.currentTime = 88;

      await holdShiftArrow("ArrowRight");
      await advance(HOLD_DELAY_MS);
      expect(seeks()).toEqual([93, 98]);

      await advance(SEEK_REPEAT_MS);
      expect(seeks()).toEqual([93, 98, 100]);

      // The track ended and the queue moved on while the keys are still down.
      Object.assign(player, { currentTrack: { kind: "library", id: "b" }, duration: 200 });
      engine.currentTime = 0;
      await advance(SEEK_REPEAT_MS * 10);

      expect(seeks()).toEqual([93, 98, 100]);
    });

    it("stops at the start instead of replaying its first moments", async () => {
      engine.currentTime = 12;

      await holdShiftArrow("ArrowLeft");
      await advance(HOLD_DELAY_MS + SEEK_REPEAT_MS * 10);

      expect(seeks()).toEqual([7, 2, 0]);
    });

    it("stops when another track starts mid-hold", async () => {
      engine.currentTime = 10;

      await holdShiftArrow("ArrowRight");
      await advance(HOLD_DELAY_MS);
      expect(seeks()).toEqual([15, 20]);

      player.currentTrack = { kind: "library", id: "b" };
      engine.currentTime = 0;
      await advance(SEEK_REPEAT_MS * 5);

      expect(seeks()).toEqual([15, 20]);
    });

    it("keeps holding through a metadata refresh of the same track", async () => {
      engine.currentTime = 10;

      await holdShiftArrow("ArrowRight");
      await advance(HOLD_DELAY_MS);
      player.currentTrack = { kind: "library", id: "a" };
      await advance(SEEK_REPEAT_MS);

      expect(seeks()).toEqual([15, 20, 25]);
    });

    it("does nothing while the track cannot seek, and stops a hold that loses it", async () => {
      player.canSeek = false;
      engine.currentTime = 10;
      await holdShiftArrow("ArrowRight");
      await advance(HOLD_DELAY_MS + SEEK_REPEAT_MS * 3);
      await releaseShiftArrow("ArrowRight");
      expect(seeks()).toEqual([]);

      player.canSeek = true;
      await holdShiftArrow("ArrowRight");
      await advance(HOLD_DELAY_MS);
      player.canSeek = false;
      await advance(SEEK_REPEAT_MS * 5);

      expect(seeks()).toEqual([15, 20]);
    });

    it("stops a hold when the composable's owner unmounts", async () => {
      engine.currentTime = 10;

      await holdShiftArrow("ArrowRight");
      wrapper?.unmount();
      wrapper = null;
      await advance(HOLD_DELAY_MS + SEEK_REPEAT_MS * 3);

      expect(seeks()).toEqual([15]);
    });
  });
});
