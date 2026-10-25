import path from "node:path";
import { readFileSync } from "node:fs";
import { mount, type VueWrapper } from "@vue/test-utils";
import { h } from "vue";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Scrollable from "../Scrollable.vue";
import scrollableSource from "../Scrollable.vue?raw";
import { installLayoutStubs, removeLayoutStubs, settle } from "./scrollable-fakes";

vi.mock("@/lib/environment/overlayScrollSupport", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/environment/overlayScrollSupport")>(),
  IS_OVERLAY_SCROLL_SUPPORTED: false,
}));

const VIEWPORT = 400;
const CONTENT = 4000;
const THUMB_SIZE = VIEWPORT ** 2 / CONTENT;

// Vitest loads neither SFC styles nor CSS imports (.css?raw is empty too), and the layout of both modes lives there.
const sharedCss = readFileSync(path.resolve(process.cwd(), "src/components/ui/scrollable/scrollable.css"), "utf8");
let styleElement: HTMLStyleElement | null = null;
let mounted: VueWrapper | null = null;

const mountScrollable = (props: { fitContent?: boolean } = {}) => {
  mounted = mount(Scrollable, {
    props,
    slots: { default: () => h("div") },
    attachTo: document.body,
  });
  const outer = mounted.element as HTMLElement;
  const inner = mounted.find(".scrollable").element as HTMLElement;
  return { wrapper: mounted, outer, inner };
};

beforeAll(() => {
  styleElement = document.createElement("style");
  styleElement.textContent = sharedCss + (/<style>([\s\S]*?)<\/style>/.exec(scrollableSource)?.[1] ?? "");
  document.head.append(styleElement);
});

afterAll(() => {
  styleElement?.remove();
});

beforeEach(() => {
  installLayoutStubs({ viewport: VIEWPORT, content: CONTENT });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  removeLayoutStubs();
});

describe("Scrollable fit content", () => {
  it("takes its height from the content in fit mode", () => {
    const { outer, inner } = mountScrollable({ fitContent: true });

    expect(getComputedStyle(inner).position).not.toBe("absolute");
    expect(getComputedStyle(inner).height).not.toBe("100%");
    expect(getComputedStyle(outer).height).not.toBe("100%");
  });

  it("still stretches to the parent by default", () => {
    const { outer, inner } = mountScrollable();

    expect(getComputedStyle(inner).position).toBe("absolute");
    expect(getComputedStyle(inner).height).toBe("100%");
    expect(getComputedStyle(outer).height).toBe("100%");
  });

  it("shows its own thumb when fit content overflows", async () => {
    const { wrapper, inner } = mountScrollable({ fitContent: true });
    await settle();

    const thumb = wrapper.find<HTMLElement>(".scrollable-thumb");
    expect(thumb.exists()).toBe(true);
    expect(thumb.element.style.height).toBe(`${THUMB_SIZE}px`);
    expect(thumb.element.style.transform).toBe("translateY(0px)");

    inner.scrollTop = 1800;
    inner.dispatchEvent(new Event("scroll"));
    await settle();

    expect(thumb.element.style.transform).not.toBe("translateY(0px)");
  });
});
