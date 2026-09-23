import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef } from "vue";
import { mount } from "@vue/test-utils";
import { useOwnerResizeObserver } from "../useOwnerResizeObserver";

// A PiP document belongs to another window; only that window's
// ResizeObserver reports on its elements.
const fakeWindow = () => {
  const observed: Element[] = [];
  const disconnect = vi.fn();
  class FakeResizeObserver {
    constructor(public callback: ResizeObserverCallback) {}
    observe = (el: Element) => { observed.push(el); };
    disconnect = disconnect;
    unobserve = vi.fn();
  }
  return { win: { ResizeObserver: FakeResizeObserver } as unknown as Window, observed, disconnect };
};

const elementIn = (win: Window) => {
  const el = document.createElement("div");
  Object.defineProperty(el, "ownerDocument", { value: { defaultView: win } });
  return el;
};

const host = (target: ReturnType<typeof shallowRef<HTMLElement | null>>) => defineComponent({
  setup() {
    useOwnerResizeObserver(target, () => {});
    return () => h("div");
  },
});

describe("useOwnerResizeObserver", () => {
  it("observes through the window the element belongs to", async () => {
    const pip = fakeWindow();
    const target = shallowRef<HTMLElement | null>(elementIn(pip.win));

    mount(host(target));
    await nextTick();

    expect(pip.observed).toEqual([target.value]);
  });

  it("moves to the new element's window when the target changes", async () => {
    const first = fakeWindow();
    const second = fakeWindow();
    const target = shallowRef<HTMLElement | null>(elementIn(first.win));
    mount(host(target));
    await nextTick();

    target.value = elementIn(second.win);
    await nextTick();

    expect(first.disconnect).toHaveBeenCalled();
    expect(second.observed).toEqual([target.value]);
  });

  it("disconnects on unmount", async () => {
    const pip = fakeWindow();
    const target = shallowRef<HTMLElement | null>(elementIn(pip.win));
    const wrapper = mount(host(target));
    await nextTick();

    wrapper.unmount();

    expect(pip.disconnect).toHaveBeenCalled();
  });
});
