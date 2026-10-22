import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VirtualScrollable from "../VirtualScrollable.vue";

// The virtualizer notifies only when the visible range or isScrolling
// changes. Anything in the list's render that follows the scroll offset
// itself would rebuild every row's vnodes on every frame of a scroll.

interface Row {
  id: string;
}

const ROW_HEIGHT = 40;
const VIEWPORT_HEIGHT = 400;
const ROW_COUNT = 100;

const installLayoutStubs = () => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const height = (this as HTMLElement).classList?.contains("scrollable") ? VIEWPORT_HEIGHT : 0;
    return { top: 0, bottom: height, height, width: 300, left: 0, right: 300, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  const viewportOnly = { configurable: true, get(this: HTMLElement) { return this.classList.contains("scrollable") ? VIEWPORT_HEIGHT : 0; } };
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", viewportOnly);
  Object.defineProperty(HTMLElement.prototype, "clientHeight", viewportOnly);
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) { return this.classList.contains("scrollable") ? ROW_COUNT * ROW_HEIGHT : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 300 });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
};

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const flush = async () => {
  await nextFrame();
  await nextTick();
  await nextTick();
};

const mountList = () => {
  const rows = Array.from({ length: ROW_COUNT }, (_, i): Row => ({ id: `r${i}` }));
  let rowRenders = 0;
  const wrapper = mount(VirtualScrollable<Row>, {
    props: {
      items: rows,
      itemHeight: ROW_HEIGHT,
      estimateSize: ROW_HEIGHT,
      getItemKey: (index: number) => rows[index].id,
    },
    slots: {
      default: ({ item }: { item: Row }) => {
        rowRenders++;
        return h("span", item.id);
      },
    },
  });
  const container = wrapper.find(".scrollable").element as HTMLElement;
  const scrollTo = async (top: number) => {
    container.scrollTop = top;
    container.dispatchEvent(new Event("scroll"));
    await flush();
  };
  return { wrapper, scrollTo, rowRenders: () => rowRenders };
};

beforeEach(() => {
  installLayoutStubs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const prop of ["offsetHeight", "clientHeight", "scrollHeight", "offsetWidth"]) {
    Reflect.deleteProperty(HTMLElement.prototype, prop);
  }
});

describe("VirtualScrollable renders", () => {
  it("does not re-render its rows for a scroll that keeps the same rows on screen", async () => {
    const list = mountList();
    await flush();
    await list.scrollTo(30 * ROW_HEIGHT + 10);
    expect(list.wrapper.find("[data-index='30']").exists()).toBe(true);
    const before = list.rowRenders();

    await list.scrollTo(30 * ROW_HEIGHT + 15);
    await list.scrollTo(30 * ROW_HEIGHT + 25);

    expect(list.rowRenders()).toBe(before);
  });

  it("renders the rows that a longer scroll brings in", async () => {
    const list = mountList();
    await flush();

    await list.scrollTo(30 * ROW_HEIGHT);

    expect(list.wrapper.find("[data-index='30']").exists()).toBe(true);
  });
});
