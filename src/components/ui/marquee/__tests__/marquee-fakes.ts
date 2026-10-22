import { afterEach, beforeEach, vi } from "vitest";
import type { DOMWrapper, VueWrapper } from "@vue/test-utils";

// happy-dom does no layout: sizes are set by hand, resize notifications are
// fired by hand, and the animation is a spy.
const observers: Array<{ callback: ResizeObserverCallback }> = [];
class FakeResizeObserver {
  constructor(public callback: ResizeObserverCallback) { observers.push(this); }
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
}
export const notifyResize = () => observers.forEach(o => o.callback([], o as unknown as ResizeObserver));

export interface FakeAnimation {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  target: HTMLElement;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  startTime: number | null;
  playState: string;
  ready: Promise<unknown>;
  cancel: ReturnType<typeof vi.fn>;
  finished: Promise<unknown>;
  finish: () => Promise<void>;
}
export const animations: FakeAnimation[] = [];
export const animate = vi.fn(function (this: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  let resolve: (value: unknown) => void = () => {};
  const finished = new Promise((r) => { resolve = r; });
  const animation: FakeAnimation = {
    keyframes, options, target: this, cancel: vi.fn(), finished,
    startTime: null, playState: "running", ready: Promise.resolve(),
    pause: vi.fn(() => { animation.playState = "paused"; }),
    // A resume restarts the clock off the grid.
    play: vi.fn(() => { animation.playState = "running"; animation.startTime = 1234.5; }),
    finish: async () => { resolve(animation); await finished; await Promise.resolve(); },
  };
  animations.push(animation);
  return animation as unknown as Animation;
});
export const movingLoops = () => animations.filter(a => a.target.classList.contains("marquee-content"));

export const setSize = (el: Element, prop: "clientWidth" | "offsetWidth", value: number) =>
  Object.defineProperty(el, prop, { configurable: true, get: () => value });

export const layout = (wrapper: VueWrapper | DOMWrapper<Element>, sizes: { container: number; text: number; gap?: number }) => {
  const gap = sizes.gap ?? 48;
  setSize(wrapper.find(".marquee-wrapper").element, "clientWidth", sizes.container);
  setSize(wrapper.find(".marquee-item").element, "offsetWidth", sizes.text);
  setSize(wrapper.find(".marquee-track").element, "offsetWidth", Math.max(sizes.container, sizes.text + gap));
  notifyResize();
};

export const useMarqueeFakes = () => {
  beforeEach(() => {
    observers.length = 0;
    animations.length = 0;
    animate.mockClear();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    Object.defineProperty(document, "timeline", { configurable: true, value: { currentTime: 1000.5 } });
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
};
