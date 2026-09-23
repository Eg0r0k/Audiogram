import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MarqueeBlock from "../MarqueeBlock.vue";
import { MARQUEE_PAUSE_MS, MARQUEE_SPEED, MARQUEE_UPDATE_RATE, marqueeMotion } from "../marqueeMotion";

// happy-dom does no layout: sizes are set by hand, resize notifications are
// fired by hand, and the animation is a spy.
const observers: Array<{ callback: ResizeObserverCallback }> = [];
class FakeResizeObserver {
  constructor(public callback: ResizeObserverCallback) { observers.push(this); }
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
}
const notifyResize = () => observers.forEach(o => o.callback([], o as unknown as ResizeObserver));

interface FakeAnimation {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  target: HTMLElement;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  finished: Promise<unknown>;
  finish: () => Promise<void>;
}
const animations: FakeAnimation[] = [];
const animate = vi.fn(function (this: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  let resolve: (value: unknown) => void = () => {};
  const finished = new Promise((r) => { resolve = r; });
  const animation: FakeAnimation = {
    keyframes, options, target: this, pause: vi.fn(), play: vi.fn(), cancel: vi.fn(), finished,
    finish: async () => { resolve(animation); await finished; await Promise.resolve(); },
  };
  animations.push(animation);
  return animation as unknown as Animation;
});
const movingLoops = () => animations.filter(a => a.target.classList.contains("marquee-content"));

const setSize = (el: Element, prop: "clientWidth" | "offsetWidth", value: number) =>
  Object.defineProperty(el, prop, { configurable: true, get: () => value });

const layout = (wrapper: ReturnType<typeof mount>, sizes: { container: number; text: number; gap?: number }) => {
  const gap = sizes.gap ?? 48;
  setSize(wrapper.find(".marquee-wrapper").element, "clientWidth", sizes.container);
  setSize(wrapper.find(".marquee-item").element, "offsetWidth", sizes.text);
  setSize(wrapper.find(".marquee-track").element, "offsetWidth", Math.max(sizes.container, sizes.text + gap));
  notifyResize();
};

const mountMarquee = (props: Record<string, unknown> = {}) =>
  mount(MarqueeBlock, { props, slots: { default: "<span>Some title</span>" }, attachTo: document.body });

beforeEach(() => {
  observers.length = 0;
  animations.length = 0;
  animate.mockClear();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MarqueeBlock", () => {
  it("leaves text that fits in place, even with less than the loop gap to spare", async () => {
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 162 });
    await wrapper.vm.$nextTick();

    expect(animate).not.toHaveBeenCalled();
    expect(wrapper.findAll(".marquee-track")).toHaveLength(1);
  });

  it("scrolls overflowing text one loop further at the default speed in px/s", async () => {
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    const [animation] = animations;
    const expected = marqueeMotion(448, MARQUEE_SPEED, MARQUEE_PAUSE_MS);
    expect(animation?.options.duration).toBeCloseTo(expected.durationMs);
    expect(animation?.keyframes.at(-1)?.transform).toBe("translateX(-448px)");
    expect(animation?.keyframes[1]).toMatchObject({ transform: "translateX(0)", offset: expected.holdOffset });
    expect(wrapper.findAll(".marquee-track")).toHaveLength(2);
  });

  it("starts moving at once and rests only between loops", async () => {
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(animations[0]?.options.delay).toBe(-MARQUEE_PAUSE_MS);
  });

  it("keeps a requested delay before the first loop", async () => {
    const wrapper = mountMarquee({ delay: 2 });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(animations[0]?.options.delay).toBe(2000 - MARQUEE_PAUSE_MS);
  });

  it("updates the position a fixed number of times per second, whatever the display rate", async () => {
    const wrapper = mountMarquee({ speed: 40 });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(animations[0]?.keyframes[1]?.easing).toBe(`steps(${Math.round((448 / 40) * MARQUEE_UPDATE_RATE)})`);
  });

  it("animates the pair of copies as one element", async () => {
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(wrapper.find(".marquee-content").element);
  });

  it("takes a speed override in px/s", async () => {
    const wrapper = mountMarquee({ speed: 60 });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(animations[0]?.options.duration).toBeCloseTo(marqueeMotion(448, 60, MARQUEE_PAUSE_MS).durationMs);
  });

  it("restarts with the new distance when the text changes", async () => {
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();
    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 600 });
    await wrapper.vm.$nextTick();

    expect(animations[0]?.cancel).toHaveBeenCalled();
    expect(animations[1]?.keyframes.at(-1)?.transform).toBe("translateX(-648px)");
  });

  it("stops once the text fits again", async () => {
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();
    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 100 });
    await wrapper.vm.$nextTick();

    expect(animations[0]?.cancel).toHaveBeenCalled();
    expect(wrapper.findAll(".marquee-track")).toHaveLength(1);
  });

  it("pauses while hovered and resumes after", async () => {
    const wrapper = mountMarquee({ pauseOnHover: true });
    await wrapper.vm.$nextTick();
    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    await wrapper.find(".marquee-wrapper").trigger("pointerenter");
    expect(animations[0]?.pause).toHaveBeenCalled();

    await wrapper.find(".marquee-wrapper").trigger("pointerleave");
    expect(animations[0]?.play).toHaveBeenCalled();
  });

  it("measures on resize notifications only, without polling", async () => {
    const setInterval = vi.spyOn(globalThis, "setInterval");
    const wrapper = mountMarquee();
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(setInterval).not.toHaveBeenCalled();
    setInterval.mockRestore();
  });
});

// happy-dom drops CSS it cannot parse (var() in background, mask-image), so
// the style Vue binds is read off the vnode instead of the element.
const boundStyle = (el: Element) =>
  ((el as unknown as { __vnode?: { props?: { style?: Record<string, string> } } }).__vnode?.props?.style ?? {});

describe("MarqueeBlock edge fades", () => {
  it("fades with static overlays of the given colour instead of a mask", async () => {
    const wrapper = mountMarquee({ gradient: true, gradientColor: "var(--card)", gradientLength: "20px" });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(boundStyle(wrapper.find(".marquee-wrapper").element)).not.toHaveProperty("maskImage");
    const fades = wrapper.findAll(".marquee-fade");
    expect(fades).toHaveLength(2);
    for (const fade of fades) {
      expect(boundStyle(fade.element).background).toContain("var(--card)");
      expect(boundStyle(fade.element).width).toBe("20px");
    }
  });

  it("falls back to a mask when the background is not a single colour", async () => {
    const wrapper = mountMarquee({ gradient: true, gradientLength: "20px" });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    expect(boundStyle(wrapper.find(".marquee-wrapper").element).maskImage).toContain("linear-gradient");
    expect(wrapper.findAll(".marquee-fade")).toHaveLength(0);
  });

  it("draws no fades while the text fits", async () => {
    const wrapper = mountMarquee({ gradient: true, gradientColor: "var(--card)" });
    await wrapper.vm.$nextTick();

    layout(wrapper, { container: 200, text: 100 });
    await wrapper.vm.$nextTick();

    for (const fade of wrapper.findAll(".marquee-fade")) expect(fade.isVisible()).toBe(false);
  });
});

describe("MarqueeBlock loops", () => {
  const overflowing = async (props: Record<string, unknown> = {}) => {
    const wrapper = mountMarquee(props);
    await wrapper.vm.$nextTick();
    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();
    return wrapper;
  };

  it("runs the next loop, rest first, once the previous one ends", async () => {
    await overflowing();

    await movingLoops()[0]!.finish();

    const [, second] = movingLoops();
    expect(second?.options.delay).toBe(0);
    expect(second?.keyframes[1]?.offset).toBeGreaterThan(0);
  });

  it("stops after the requested number of loops", async () => {
    await overflowing({ loop: 2 });

    await movingLoops()[0]!.finish();
    await movingLoops()[1]!.finish();

    expect(movingLoops()).toHaveLength(2);
  });

  it("does not come back after it was stopped", async () => {
    const wrapper = await overflowing();
    const first = movingLoops()[0]!;

    layout(wrapper, { container: 200, text: 100 });
    await wrapper.vm.$nextTick();
    await first.finish();

    expect(movingLoops()).toHaveLength(1);
  });
});

describe("MarqueeBlock start fade", () => {
  // The start fade appears over the time the text needs to cross it (20 px
  // at the default speed) once the line moves, and leaves the same way.
  const loop = marqueeMotion(448, MARQUEE_SPEED, MARQUEE_PAUSE_MS);
  const rampMs = (20 / MARQUEE_SPEED) * 1000;
  const travelMs = loop.durationMs - MARQUEE_PAUSE_MS;

  const overflowing = async (props: Record<string, unknown>) => {
    const wrapper = mountMarquee({ gradient: true, gradientLength: "20px", ...props });
    await wrapper.vm.$nextTick();
    layout(wrapper, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();
    return wrapper;
  };

  const fadesOn = (el: Element) => animations.filter(a => a.target === el);

  it("hides the start overlay while the line rests, so its first letters stay readable", async () => {
    const wrapper = await overflowing({ gradientColor: "var(--card)" });

    const [fadeIn, fadeOut] = fadesOn(wrapper.find(".marquee-fade.start").element);
    expect(fadeIn?.keyframes.map(k => k.opacity)).toEqual([0, 1]);
    expect(fadeIn?.options).toMatchObject({ delay: 0, fill: "both" });
    expect(fadeIn?.options.duration).toBeCloseTo(rampMs);
    expect(fadeOut?.keyframes.map(k => k.opacity)).toEqual([1, 0]);
    expect(fadeOut?.options.delay).toBeCloseTo(travelMs - rampMs);
  });

  it("opens the mask's start edge only while the line moves", async () => {
    const wrapper = await overflowing({});

    const [fadeIn, fadeOut] = fadesOn(wrapper.find(".marquee-wrapper").element);
    expect(fadeIn?.keyframes.map(k => k["--marquee-fade-start"])).toEqual(["0px", "20px"]);
    expect(fadeOut?.keyframes.map(k => k["--marquee-fade-start"])).toEqual(["20px", "0px"]);
    expect(boundStyle(wrapper.find(".marquee-wrapper").element).maskImage).toContain("var(--marquee-fade-start)");
  });

  it("waits out the rest before showing the fade on later loops", async () => {
    const wrapper = await overflowing({ gradientColor: "var(--card)" });

    await movingLoops()[0]!.finish();

    const fades = fadesOn(wrapper.find(".marquee-fade.start").element);
    expect(fades[2]?.options.delay).toBe(MARQUEE_PAUSE_MS);
    for (const earlier of fades.slice(0, 2)) expect(earlier.cancel).toHaveBeenCalled();
  });

  it("pauses the fade together with the scroll", async () => {
    const wrapper = await overflowing({ gradientColor: "var(--card)", pauseOnHover: true });

    await wrapper.find(".marquee-wrapper").trigger("pointerenter");

    expect(animations).toHaveLength(3);
    for (const animation of animations) expect(animation.pause).toHaveBeenCalled();
  });
});
