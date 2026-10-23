import { mount } from "@vue/test-utils";
import { h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import Scrollable from "../Scrollable.vue";
import { installLayoutStubs, removeLayoutStubs, settle } from "./scrollable-fakes";

vi.mock("@/lib/environment/overlayScrollSupport", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/environment/overlayScrollSupport")>(),
  IS_OVERLAY_SCROLL_SUPPORTED: false,
}));

const VIEWPORT = 400;
const CONTENT = 4000;
const THUMB_SIZE = VIEWPORT ** 2 / CONTENT;
const thumbOffsetAt = (position: number) => (position / (CONTENT - VIEWPORT)) * (VIEWPORT - THUMB_SIZE);

const mountScrollable = (direction: "vertical" | "horizontal") => {
  let slotRenders = 0;
  const wrapper = mount(Scrollable, {
    props: { direction },
    slots: {
      default: () => {
        slotRenders++;
        return h("div");
      },
    },
  });
  const container = wrapper.find(".scrollable").element as HTMLElement;
  const axis = direction === "vertical" ? "scrollTop" : "scrollLeft";
  const scrollTo = async (position: number) => {
    container[axis] = position;
    container.dispatchEvent(new Event("scroll"));
    await settle();
  };
  const thumb = () => wrapper.find<HTMLElement>(".scrollable-thumb");
  return { wrapper, scrollTo, thumb, slotRenders: () => slotRenders };
};

afterEach(removeLayoutStubs);

describe("Scrollable thumb", () => {
  it("does not re-render its slot when only the scroll thumb moves", async () => {
    installLayoutStubs({ viewport: VIEWPORT, content: CONTENT });
    const scrollable = mountScrollable("vertical");
    await settle();
    await scrollable.scrollTo(100);
    const before = scrollable.slotRenders();
    const transformBefore = scrollable.thumb().element.style.transform;

    await scrollable.scrollTo(200);
    await scrollable.scrollTo(300);

    expect(scrollable.thumb().element.style.transform).not.toBe(transformBefore);
    expect(scrollable.slotRenders()).toBe(before);
  });

  it("sizes and moves a horizontal thumb along x", async () => {
    installLayoutStubs({ viewport: VIEWPORT, content: CONTENT, axis: "x" });
    const scrollable = mountScrollable("horizontal");
    await settle();

    const container = scrollable.wrapper.find(".scrollable-thumb-container");
    expect(container.classes()).toContain("scrollable-thumb-container-x");
    expect(container.classes()).not.toContain("scrollable-thumb-container-y");
    expect(scrollable.thumb().element.style.width).toBe(`${THUMB_SIZE}px`);
    expect(scrollable.thumb().element.style.height).toBe("");
    expect(scrollable.thumb().element.style.transform).toBe("translateX(0px)");

    await scrollable.scrollTo(1800);

    expect(scrollable.thumb().element.style.transform).toBe(`translateX(${thumbOffsetAt(1800)}px)`);
  });
});
