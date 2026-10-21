import { defineComponent, h, nextTick, reactive } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockPlayer = { currentTime: 0, duration: 200 };
const mockStore = reactive({
  player: mockPlayer as { currentTime: number; duration: number } | null,
  currentTime: 0,
  isPlaying: false,
  status: "paused",
  currentTrack: { id: "t1" } as { id: string } | null,
  isLiveStream: false,
  canSeek: true,
  seekPercent: vi.fn(),
});

vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => mockStore }));

import { FRAME_GRID_MS } from "@/lib/frame-grid";
import { usePlayerProgress } from "../usePlayerProgress";

let frames: FrameRequestCallback[] = [];

const Bar = defineComponent({
  setup() {
    const { displayProgress, onScrubStart, onScrub, onScrubEnd } = usePlayerProgress();
    return { displayProgress, onScrubStart, onScrub, onScrubEnd };
  },
  render() {
    return h("div", String(this.displayProgress));
  },
});

type BarVm = { onScrubStart: () => void; onScrub: (value: number) => void; onScrubEnd: () => void };

describe("usePlayerProgress", () => {
  // The first mount creates the renderer, which arms a devtools-hook timer
  // that would count as a loop under fake timers.
  beforeAll(() => {
    mount(defineComponent({ render: () => null })).unmount();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("innerWidth", 1000);
    mockPlayer.currentTime = 0;
    mockStore.currentTime = 0;
    mockStore.isPlaying = false;
    mockStore.status = "paused";
    mockStore.seekPercent.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs one loop for any number of bars", async () => {
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const first = mount(Bar);
    const second = mount(Bar);

    expect(vi.getTimerCount()).toBe(1);
    mockPlayer.currentTime = 50;
    vi.advanceTimersByTime(100 + FRAME_GRID_MS);
    await nextTick();

    expect(vi.getTimerCount()).toBe(1);
    expect(first.text()).toBe("25");
    expect(second.text()).toBe("25");

    first.unmount();
    second.unmount();
  });

  it("stops the loop with the last bar and starts fresh for the next one", async () => {
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const bar = mount(Bar);
    expect(vi.getTimerCount()).toBe(1);
    bar.unmount();

    expect(vi.getTimerCount()).toBe(0);
    mockPlayer.currentTime = 100;
    const next = mount(Bar);
    await nextTick();

    expect(vi.getTimerCount()).toBe(1);
    expect(next.text()).toBe("50");
    next.unmount();
  });

  it("wakes only as often as the bar can visibly move, not every frame", async () => {
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const bar = mount(Bar);
    expect(frames).toHaveLength(0);

    // Half a pixel of a 1000 px window is 0.05 %: 100 ms of a 200 s track,
    // then up to one 60 Hz grid tick to land on the shared frame grid.
    mockPlayer.currentTime = 20;
    vi.advanceTimersByTime(99);
    await nextTick();
    expect(bar.text()).toBe("0");

    vi.advanceTimersByTime(FRAME_GRID_MS + 1);
    await nextTick();
    expect(bar.text()).toBe("10");
    bar.unmount();
  });

  it("steps by half a pixel of the window, so a wide window gets finer steps", async () => {
    vi.stubGlobal("innerWidth", 2000);
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const bar = mount(Bar);

    // 0.025 % of a 200 s track is 50 ms.
    mockPlayer.currentTime = 0.05;
    vi.advanceTimersByTime(50 + FRAME_GRID_MS);
    await nextTick();

    expect(bar.text()).toBe("0.025");
    bar.unmount();
  });

  it("does not drop a tick whose move falls a hair short of a full step", async () => {
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const bar = mount(Bar);

    // Timers run a little early or late, so a tick sized to one step often
    // sees slightly less than one.
    mockPlayer.currentTime = 0.099;
    vi.advanceTimersByTime(100 + FRAME_GRID_MS);
    await nextTick();

    expect(bar.text()).toBe("0.0495");
    bar.unmount();
  });

  it("wakes on the shared 60 Hz frame grid", async () => {
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const delays: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", ((fn: () => void, ms?: number) => {
      delays.push(performance.now() + (ms ?? 0));
      return realSetTimeout(fn, ms);
    }) as typeof setTimeout);
    const bar = mount(Bar);

    const wake = delays.at(-1)!;
    const ticks = wake / FRAME_GRID_MS;
    expect(Math.abs(ticks - Math.round(ticks))).toBeLessThan(1e-3);
    bar.unmount();
  });

  it("follows a seek made while paused", async () => {
    const bar = mount(Bar);
    expect(bar.text()).toBe("0");

    // The element moves at once; the store hears it on the seek's timeupdate.
    mockPlayer.currentTime = 100;
    mockStore.currentTime = 100;
    await nextTick();

    expect(bar.text()).toBe("50");
    expect(vi.getTimerCount()).toBe(0);
    bar.unmount();
  });

  it("holds the scrub target after release and seeks the player", async () => {
    mockStore.isPlaying = true;
    mockStore.status = "playing";
    const bar = mount(Bar);
    const vm = bar.vm as unknown as BarVm;

    vm.onScrubStart();
    vm.onScrub(80);
    await nextTick();
    expect(bar.text()).toBe("80");

    vm.onScrubEnd();
    await nextTick();
    expect(mockStore.seekPercent).toHaveBeenCalledWith(80);
    expect(bar.text()).toBe("80");
    bar.unmount();
  });
});
