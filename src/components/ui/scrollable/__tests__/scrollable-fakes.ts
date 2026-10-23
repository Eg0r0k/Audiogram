import { mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { vi, type MockInstance } from "vitest";
import VirtualScrollable from "../VirtualScrollable.vue";

export interface Row {
  id: string;
}

export const ROW_HEIGHT = 40;
export const VIEWPORT_HEIGHT = 400;
export const ROW_COUNT = 100;

export interface ScrollerLayout {
  viewport: number;
  content: number;
  axis?: "x" | "y";
}

export const LIST_LAYOUT: ScrollerLayout = { viewport: VIEWPORT_HEIGHT, content: ROW_COUNT * ROW_HEIGHT };

const AXIS_PROPS = {
  y: { offset: "offsetHeight", client: "clientHeight", scroll: "scrollHeight" },
  x: { offset: "offsetWidth", client: "clientWidth", scroll: "scrollWidth" },
} as const;

const CROSS_SIZE = 300;

const isScroller = (el: Element) => el.classList?.contains("scrollable") ?? false;

const scrollerOnly = (value: number): PropertyDescriptor => ({
  configurable: true,
  get(this: HTMLElement) { return isScroller(this) ? value : 0; },
});

const originals = new Map<string, PropertyDescriptor | undefined>();
let rectSpy: MockInstance<() => DOMRect> | null = null;

const stubProperty = (prop: string, descriptor: PropertyDescriptor) => {
  if (!originals.has(prop)) originals.set(prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
  Object.defineProperty(HTMLElement.prototype, prop, descriptor);
};

// happy-dom has no layout: only the scroll container (.scrollable) has a size
// along the scroll axis.
export const installLayoutStubs = ({ viewport, content, axis = "y" }: ScrollerLayout) => {
  rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const size = isScroller(this) ? viewport : 0;
    const width = axis === "x" ? size : CROSS_SIZE;
    const height = axis === "y" ? size : 0;
    return { top: 0, bottom: height, height, width, left: 0, right: width, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  const props = AXIS_PROPS[axis];
  stubProperty(props.offset, scrollerOnly(viewport));
  stubProperty(props.client, scrollerOnly(viewport));
  stubProperty(props.scroll, scrollerOnly(content));
  if (axis === "y") stubProperty("offsetWidth", { configurable: true, get: () => CROSS_SIZE });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
};

export const removeLayoutStubs = () => {
  rectSpy?.mockRestore();
  rectSpy = null;
  vi.unstubAllGlobals();
  for (const [prop, original] of originals) {
    if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
    else Reflect.deleteProperty(HTMLElement.prototype, prop);
  }
  originals.clear();
};

export const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export const flush = async () => {
  await nextFrame();
  await nextTick();
  await nextTick();
};

// useScrollable measures a scroll in one frame and moves the thumb in the next.
export const settle = async () => {
  await flush();
  await flush();
};

export const mountList = (extraProps: { hideThumb?: boolean } = {}) => {
  const rows = Array.from({ length: ROW_COUNT }, (_, i): Row => ({ id: `r${i}` }));
  let rowRenders = 0;
  const wrapper = mount(VirtualScrollable<Row>, {
    props: {
      items: rows,
      itemHeight: ROW_HEIGHT,
      estimateSize: ROW_HEIGHT,
      getItemKey: (index: number) => rows[index].id,
      ...extraProps,
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
    await settle();
  };
  return { wrapper, scrollTo, rowRenders: () => rowRenders };
};
