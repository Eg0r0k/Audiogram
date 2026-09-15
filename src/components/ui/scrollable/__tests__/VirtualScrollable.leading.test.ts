import { render } from "@testing-library/vue";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Virtualizer } from "@tanstack/vue-virtual";

// Captures the virtualizer the component builds: the leading block must land
// in its scrollMargin, or every row is drawn that many pixels too high.
const captured = vi.hoisted(() => ({ virtualizer: null as Virtualizer<HTMLElement, Element> | null }));
vi.mock("@tanstack/vue-virtual", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/vue-virtual")>();
  return {
    ...actual,
    useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) => {
      const virtualizer = actual.useVirtualizer(options);
      captured.virtualizer = virtualizer.value as Virtualizer<HTMLElement, Element>;
      return virtualizer;
    },
  };
});

import VirtualScrollable from "../VirtualScrollable.vue";

interface Row {
  id: string;
}

const ROW_HEIGHT = 40;
const LEADING_HEIGHT = 56;
const VIEWPORT_HEIGHT = 400;

const makeRows = (count: number): Row[] => Array.from({ length: count }, (_, i) => ({ id: `r${i}` }));

// jsdom has no layout: the scroll container gets a viewport, the leading
// block its height, everything else reports 0.
const installLayoutStubs = () => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    let height = 0;
    if (el.classList?.contains("scrollable")) height = VIEWPORT_HEIGHT;
    if (el.classList?.contains("virtual-scrollable-leading")) height = LEADING_HEIGHT;
    return { top: 0, bottom: height, height, width: 300, left: 0, right: 300, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("scrollable") ? VIEWPORT_HEIGHT : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 300 });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
};

const PADDING_TOP = 16;

const mountList = (rows: Row[], withLeading = true) => render(VirtualScrollable<Row>, {
  props: {
    items: rows,
    itemHeight: ROW_HEIGHT,
    estimateSize: ROW_HEIGHT,
    paddingTop: PADDING_TOP,
    getItemKey: (index: number) => rows[index].id,
  },
  slots: {
    sticky: `<div data-testid="sticky">sort</div>`,
    ...(withLeading ? { leading: `<div data-testid="leading">add</div>` } : {}),
    default: `<template #default="{ item }"><span>{{ item.id }}</span></template>`,
  },
});

const firstRowOffset = (container: HTMLElement) => {
  const transform = container.querySelector<HTMLElement>("[data-vkey]")!.style.transform;
  return Number(/translateY\((-?[\d.]+)px\)/.exec(transform)![1]);
};

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const flush = async () => {
  await nextFrame();
  await nextTick();
  await nextTick();
};

describe("VirtualScrollable — leading slot", () => {
  beforeEach(installLayoutStubs);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders between the sticky block and the rows", async () => {
    const { container, getByTestId } = mountList(makeRows(20));
    await flush();

    const sticky = getByTestId("sticky");
    const leading = getByTestId("leading");
    const firstRow = container.querySelector("[data-vkey]")!;
    expect(sticky.compareDocumentPosition(leading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(leading.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("counts its height into the rows' scroll margin", async () => {
    mountList(makeRows(20));
    await flush();

    expect(captured.virtualizer?.options.scrollMargin).toBe(LEADING_HEIGHT);
  });

  // The list's top padding belongs above the leading block, so the first
  // track follows the add row the way rows follow each other.
  it("takes the list's top padding for itself and hands the rows none", async () => {
    const plain = mountList(makeRows(20), false);
    await flush();
    expect(firstRowOffset(plain.container)).toBe(PADDING_TOP);
    plain.unmount();

    const { container, getByTestId } = mountList(makeRows(20));
    await flush();
    expect(getByTestId("leading").parentElement!.style.paddingTop).toBe(`${PADDING_TOP}px`);
    expect(firstRowOffset(container)).toBe(0);
  });

  it("stays when the list is empty", async () => {
    const { getByTestId } = mountList([]);
    await flush();

    expect(getByTestId("leading")).toBeInTheDocument();
  });
});
