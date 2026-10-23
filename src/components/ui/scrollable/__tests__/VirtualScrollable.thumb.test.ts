import type { VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installLayoutStubs, LIST_LAYOUT, mountList, removeLayoutStubs, ROW_COUNT, ROW_HEIGHT, settle, VIEWPORT_HEIGHT } from "./scrollable-fakes";

vi.mock("@/lib/environment/overlayScrollSupport", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/environment/overlayScrollSupport")>(),
  IS_OVERLAY_SCROLL_SUPPORTED: false,
}));

const CONTENT_HEIGHT = ROW_COUNT * ROW_HEIGHT;
const THUMB_SIZE = VIEWPORT_HEIGHT ** 2 / CONTENT_HEIGHT;
const thumbOffsetAt = (scrollTop: number) =>
  (scrollTop / (CONTENT_HEIGHT - VIEWPORT_HEIGHT)) * (VIEWPORT_HEIGHT - THUMB_SIZE);

const thumbOf = (wrapper: VueWrapper) => wrapper.find<HTMLElement>(".scrollable-thumb");

beforeEach(() => {
  installLayoutStubs(LIST_LAYOUT);
});

afterEach(removeLayoutStubs);

describe("VirtualScrollable thumb", () => {
  it("does not re-render its rows when only the scroll thumb moves", async () => {
    const list = mountList();
    await settle();
    await list.scrollTo(30 * ROW_HEIGHT + 10);
    expect(list.wrapper.find("[data-index='30']").exists()).toBe(true);
    const before = list.rowRenders();
    const transformBefore = thumbOf(list.wrapper).element.style.transform;

    await list.scrollTo(30 * ROW_HEIGHT + 15);
    await list.scrollTo(30 * ROW_HEIGHT + 25);

    expect(thumbOf(list.wrapper).element.style.transform).not.toBe(transformBefore);
    expect(list.rowRenders()).toBe(before);
  });

  it("moves the thumb with the scroll position", async () => {
    const list = mountList();
    await settle();

    const thumb = thumbOf(list.wrapper);
    expect(list.wrapper.find(".scrollable-thumb-container").classes()).toContain("scrollable-thumb-container-y");
    expect(thumb.element.style.height).toBe(`${THUMB_SIZE}px`);
    expect(thumb.element.style.transform).toBe("translateY(0px)");

    await list.scrollTo(1800);
    expect(thumbOf(list.wrapper).element.style.transform).toBe(`translateY(${thumbOffsetAt(1800)}px)`);

    await list.scrollTo(CONTENT_HEIGHT - VIEWPORT_HEIGHT);
    expect(thumbOf(list.wrapper).element.style.transform).toBe(`translateY(${VIEWPORT_HEIGHT - THUMB_SIZE}px)`);
  });

  it("renders no thumb when hideThumb is set", async () => {
    const list = mountList({ hideThumb: true });
    await settle();
    await list.scrollTo(1800);

    expect(list.wrapper.find(".scrollable-thumb-container").exists()).toBe(false);
    expect(list.wrapper.find(".scrollable-thumb").exists()).toBe(false);
  });
});
