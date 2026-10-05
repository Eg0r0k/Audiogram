import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, withDirectives } from "vue";
import vFrameGrid from "..";
import { FRAME_GRID_MS } from "@/lib/frame-grid";

const original = HTMLElement.prototype.getAnimations;
afterEach(() => { HTMLElement.prototype.getAnimations = original; });

describe("v-frame-grid", () => {
  it("puts the CSS animations of the element and its subtree on the grid, not its transitions", async () => {
    const cssAnimation = { animationName: "playing-pulse-bar", ready: Promise.resolve(), startTime: 1000.5 };
    const transition = { transitionProperty: "opacity", ready: Promise.resolve(), startTime: 1000.5 };
    let options: GetAnimationsOptions | undefined;
    HTMLElement.prototype.getAnimations = function (o?: GetAnimationsOptions) {
      options = o;
      return [cssAnimation, transition] as unknown as Animation[];
    };

    mount(defineComponent({ render: () => withDirectives(h("span"), [[vFrameGrid]]) }));
    await Promise.resolve();
    await Promise.resolve();

    expect(options).toEqual({ subtree: true });
    expect(cssAnimation.startTime / FRAME_GRID_MS).toBeCloseTo(61);
    expect(transition.startTime).toBe(1000.5);
  });
});
