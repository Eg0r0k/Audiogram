import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { i18n } from "@/app/i18n";
import { scrollableInjectionKey, type ScrollableContext } from "@/components/ui/scrollable/injection";
import type { LyricsLine } from "@/modules/player/lib/lrc";
import LyricsLines from "../LyricsLines.vue";

type LinesProps = {
  lines: readonly LyricsLine[];
  kind?: "synced" | "plain";
  activeIndex?: number;
  align?: "start" | "center";
  size?: "panel" | "fullscreen";
  anchorRatio?: number;
  times?: readonly (number | null)[];
  targetIndex?: number;
};

const linesOf = (texts: string[]): LyricsLine[] => texts.map((text, i) => ({ time: i * 5, text }));

const renderLines = (props: LinesProps, provide: Record<symbol, unknown> = {}) =>
  render(LyricsLines, {
    props: {
      kind: "synced",
      activeIndex: -1,
      align: "start",
      size: "panel",
      anchorRatio: 0.33,
      ...props,
    },
    global: { plugins: [i18n], provide },
  });

const lineEl = (text: string) => screen.getByText(text).closest("[data-slot='lyrics-line']")!;

const verseTexts = (container: Element) =>
  Array.from(container.querySelectorAll("[data-slot='lyrics-verse']")).map(verse =>
    Array.from(verse.querySelectorAll("[data-slot='lyrics-line']")).map(line => line.textContent?.trim()),
  );

const rect = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe("LyricsLines", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders one group per verse and no element for blank lines", () => {
    const { container } = renderLines({
      lines: linesOf(["One", "Two", "", "Three", "", "", "Four", "Five", ""]),
    });

    expect(verseTexts(container)).toEqual([["One", "Two"], ["Three"], ["Four", "Five"]]);
    expect(container.querySelectorAll("[data-slot='lyrics-line']")).toHaveLength(5);
  });

  it("keeps every panel line the same size when the active line changes", async () => {
    const lines = linesOf(["One", "Two", "Three"]);
    const { rerender } = renderLines({ lines, activeIndex: 1 });

    const expectSameSize = (activeText: string) => {
      for (const text of ["One", "Two", "Three"]) {
        const line = lineEl(text);
        expect(line).toHaveClass("text-xl", "leading-7", "font-semibold");
        for (const other of ["text-lg", "text-2xl", "text-3xl", "leading-tight", "leading-relaxed"]) {
          expect(line).not.toHaveClass(other);
        }
        expect(line).toHaveClass(text === activeText ? "text-foreground" : "text-muted-foreground");
      }
    };

    expectSameSize("Two");
    expect(lineEl("Two")).toHaveAttribute("aria-current", "true");

    await rerender({ activeIndex: 2 });

    expectSameSize("Three");
    expect(lineEl("Three")).toHaveAttribute("aria-current", "true");
    expect(lineEl("Two")).not.toHaveAttribute("aria-current");
  });

  it("emits select with the line and its index on a synced line", async () => {
    const lines = linesOf(["One", "", "Two"]);
    const { emitted } = renderLines({ lines });

    await userEvent.click(screen.getByRole("button", { name: "Two" }));

    expect(emitted("select")).toEqual([[lines[2], 2]]);
  });

  it("renders plain lyrics as a static list without select or resume button", async () => {
    const { container, emitted } = renderLines({
      kind: "plain",
      lines: linesOf(["First", "", "Second", "Third"]),
      activeIndex: 2,
    });

    expect(verseTexts(container)).toEqual([["First"], ["Second", "Third"]]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelector("[aria-current]")).toBeNull();
    expect(lineEl("Second").tagName).toBe("P");
    expect(lineEl("Second")).toHaveClass("text-base", "leading-6", "text-foreground");

    await userEvent.click(screen.getByText("Second"));

    expect(emitted("select")).toBeUndefined();
  });

  it("shows the given times on the right", () => {
    renderLines({
      lines: linesOf(["One", "Two", "", "Three"]),
      times: [1.2, null, null, 61.46],
    });

    const one = lineEl("One");
    const time = screen.getByText("0:01.2");
    expect(time.parentElement).toBe(one);
    expect(one.lastElementChild).toBe(time);
    expect(time).toHaveClass("text-xs", "tabular-nums", "text-muted-foreground");
    expect(lineEl("Three")).toHaveTextContent("1:01.5");
    expect(lineEl("Two").textContent?.trim()).toBe("Two");
  });

  it("marks the target line", () => {
    renderLines({
      lines: linesOf(["One", "Two", "Three"]),
      activeIndex: 0,
      targetIndex: 1,
    });

    expect(lineEl("Two")).toHaveClass("bg-muted", "text-foreground");
    expect(lineEl("Two")).not.toHaveClass("text-muted-foreground");
    expect(lineEl("One")).not.toHaveClass("bg-muted");
    expect(lineEl("Three")).not.toHaveClass("bg-muted");
  });

  it("highlights nothing when the active index points at a blank line", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
    const container = document.createElement("div");
    container.getBoundingClientRect = () => rect(0, 1000);
    const scrollable = { containerRef: ref(container) } as unknown as ScrollableContext;

    const { rerender } = renderLines(
      { lines: linesOf(["One", "", "Two"]), anchorRatio: 0.25 },
      { [scrollableInjectionKey as symbol]: scrollable },
    );
    lineEl("One").getBoundingClientRect = () => rect(400, 28);
    lineEl("Two").getBoundingClientRect = () => rect(600, 28);

    await rerender({ activeIndex: 0 });
    await vi.waitFor(() => expect(container.scrollTop).toBe(164));

    await rerender({ activeIndex: 1 });

    expect(document.querySelector("[aria-current]")).toBeNull();
    expect(lineEl("One")).toHaveClass("text-muted-foreground");
    expect(lineEl("Two")).toHaveClass("text-muted-foreground");
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(container.scrollTop).toBe(164);

    await rerender({ activeIndex: 2 });

    expect(lineEl("Two")).toHaveAttribute("aria-current", "true");
    await vi.waitFor(() => expect(container.scrollTop).toBe(528));
  });
});
