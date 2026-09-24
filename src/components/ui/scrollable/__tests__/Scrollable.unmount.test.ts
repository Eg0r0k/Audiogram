import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import Scrollable from "../Scrollable.vue";

describe("Scrollable - unmount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("removes the window resize listener and disconnects its observer", () => {
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    });
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const wrapper = mount(Scrollable, { slots: { default: "<div></div>" } });
    const handler = add.mock.calls.find(([type]) => type === "resize")?.[1];
    expect(handler).toBeTypeOf("function");

    wrapper.unmount();

    expect(remove.mock.calls.some(([type, fn]) => type === "resize" && fn === handler)).toBe(true);
    expect(disconnect).toHaveBeenCalled();
  });
});
