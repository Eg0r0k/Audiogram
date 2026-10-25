import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/types/track";

vi.mock("@/modules/player/composables/useLyricsActions", async () => {
  const { ref: vueRef } = await import("vue");
  return { useLyricsActions: () => ({ saveText: vi.fn(), isPending: vueRef(false) }) };
});

import LyricsEditor from "../LyricsEditor.vue";

const LINE = 20;
const PADDING = 16;
const VIEWPORT = 300;
const TOP_GAP = 8;

const track: Track = {
  kind: "library",
  id: "t1" as Track["id"],
  title: "Song",
  artist: "Artist",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
};

const rect = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

const textHeight = (value: string) => value.split("\n").length * LINE + PADDING;

const lyricsOf = (count: number) => Array.from({ length: count }, (_, i) => `Line ${i + 1}`).join("\n");

let scrollerTop = () => 0;

// happy-dom has no layout: the scroll area is VIEWPORT tall, a textarea is as
// tall as its lines, and the textarea starts TOP_GAP below the scroll area.
const installLayout = () => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.classList.contains("scrollable")) return rect(0, VIEWPORT);
    if (this instanceof HTMLTextAreaElement) return rect(TOP_GAP - scrollerTop(), textHeight(this.value));
    return rect(0, 0);
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) { return this.classList.contains("scrollable") ? VIEWPORT : 0; },
  });
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) { return textHeight(this.value); },
  });
};

const removeLayout = () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  Reflect.deleteProperty(HTMLTextAreaElement.prototype, "scrollHeight");
};

const renderEditor = (initial = "") => {
  const Host = defineComponent({
    setup() {
      const text = ref(initial);
      return () =>
        h("div", { class: "relative flex h-full flex-col overflow-hidden" }, [
          h(LyricsEditor, {
            "modelValue": text.value,
            "onUpdate:modelValue": (value: string) => {
              text.value = value;
            },
            track,
            "mode": "write",
            "dirty": text.value.trim() !== "",
          }),
        ]);
    },
  });
  render(Host, { global: { plugins: [i18n] } });
  const field = screen.getByRole("textbox", { name: "Lyrics" }) as HTMLTextAreaElement;
  const scroller = field.closest<HTMLElement>(".scrollable");
  if (scroller) scrollerTop = () => scroller.scrollTop;
  return { field, scroller };
};

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const typeAt = async (field: HTMLTextAreaElement, value: string, caret = value.length) => {
  field.value = value;
  field.setSelectionRange(caret, caret);
  await fireEvent.input(field);
  await nextTick();
  await nextFrame();
};

describe("LyricsEditor", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    scrollerTop = () => 0;
    installLayout();
  });

  afterEach(removeLayout);

  it("grows the textarea inside the app's scroll area instead of scrolling it", async () => {
    const { field, scroller } = renderEditor();

    expect(scroller).not.toBeNull();
    expect(field).toHaveClass("resize-none");

    field.style.borderTopWidth = "1px";
    field.style.borderBottomWidth = "1px";
    const long = lyricsOf(40);
    await typeAt(field, long);

    expect(field.style.height).toBe(`${textHeight(long) + 2}px`);
    expect(field.style.overflowY).toBe("hidden");
  });

  it("keeps the caret in view while typing at the end of a long text", async () => {
    const { field, scroller } = renderEditor();
    expect(scroller).not.toBeNull();

    const long = lyricsOf(40);
    await typeAt(field, long);

    const caretBottom = TOP_GAP + textHeight(long);
    expect(scroller!.scrollTop).toBe(caretBottom - VIEWPORT);

    await typeAt(field, `${long}\nLine 41`);
    expect(scroller!.scrollTop).toBe(caretBottom + LINE - VIEWPORT);

    const viewed = scroller!.scrollTop;
    await typeAt(field, `${long}\nLine 41!`, long.length - 3);
    expect(scroller!.scrollTop).toBe(viewed);
  });
});
