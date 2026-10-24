import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { LyricsLine } from "@/modules/player/lib/lrc";
import type { Track } from "@/modules/player/types";
import { useAttachCurrentTrackLyrics } from "@/modules/player/composables/useAttachCurrentTrackLyrics";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { tintedSurface } from "@/lib/color/tinted-surface";
import LyricsPreviewCard from "../LyricsPreviewCard.vue";

vi.mock("@/modules/player/store/lyrics.store", async () => {
  const { reactive } = await import("vue");
  const state = reactive({
    status: "idle" as "idle" | "loading" | "ready" | "error",
    lines: [] as LyricsLine[],
    activeLineIndex: -1,
    loadFor: vi.fn(async () => {}),
  });
  return { useLyricsStore: () => state };
});
vi.mock("@/modules/player/composables/useAttachCurrentTrackLyrics", async () => {
  const { ref } = await import("vue");
  const attachableTrack = ref<unknown>(null);
  return { useAttachCurrentTrackLyrics: () => ({ attachableTrack }) };
});

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

const linesOf = (texts: string[]): LyricsLine[] => texts.map((text, i) => ({ time: i * 5, text }));

const numbered = (count: number) => linesOf(Array.from({ length: count }, (_, i) => `Line ${i}`));

const lyricsStore = useLyricsStore() as unknown as {
  status: "idle" | "loading" | "ready" | "error";
  lines: LyricsLine[];
  activeLineIndex: number;
  loadFor: ReturnType<typeof vi.fn>;
};
const { attachableTrack } = useAttachCurrentTrackLyrics();

const showLyrics = (lines: LyricsLine[], activeLineIndex: number) => {
  lyricsStore.status = "ready";
  lyricsStore.lines = lines;
  lyricsStore.activeLineIndex = activeLineIndex;
};

const COVER_COLOR = "#3366cc";

const renderCard = () => render(LyricsPreviewCard, {
  props: { coverColor: COVER_COLOR },
  global: { plugins: [i18n] },
});

const shownLines = () => {
  const block = screen.getByText("Lyrics").closest("section")?.querySelector(".h-28");
  return Array.from(block?.children ?? []).map(row => row.textContent?.trim());
};

const currentLine = () => document.querySelector("[aria-current='true']")?.textContent?.trim() ?? null;

describe("LyricsPreviewCard", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    setActivePinia(createPinia());
    usePlayerStore().currentTrack = track;
    lyricsStore.status = "idle";
    lyricsStore.lines = [];
    lyricsStore.activeLineIndex = -1;
    lyricsStore.loadFor.mockClear();
    attachableTrack.value = null;
  });

  it("shows four lines around the active one: one sung, the current, two ahead", () => {
    showLyrics(numbered(10), 5);
    renderCard();

    expect(shownLines()).toEqual(["Line 4", "Line 5", "Line 6", "Line 7"]);
    expect(currentLine()).toBe("Line 5");
  });

  it("skips blank verse separators", () => {
    showLyrics(linesOf(["Line 0", "", "Line 1", "Line 2", "", "Line 3", "Line 4"]), 4);
    renderCard();

    expect(shownLines()).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"]);
    expect(currentLine()).toBe("Line 2");
  });

  it("shows the first four lines before the first one starts and the last four at the end", async () => {
    showLyrics(numbered(10), -1);
    renderCard();

    expect(shownLines()).toEqual(["Line 0", "Line 1", "Line 2", "Line 3"]);
    expect(currentLine()).toBeNull();

    lyricsStore.activeLineIndex = 9;
    await vi.waitFor(() => expect(shownLines()).toEqual(["Line 6", "Line 7", "Line 8", "Line 9"]));
    expect(currentLine()).toBe("Line 9");
  });

  it("keeps a fixed-height block with truncated lines", () => {
    showLyrics(numbered(2), 0);
    renderCard();

    const line = screen.getByText("Line 0");
    expect(line.parentElement).toHaveClass("h-28");
    expect(shownLines()).toEqual(["Line 0", "Line 1"]);
    for (const row of Array.from(line.parentElement!.children)) {
      expect(row).toHaveClass("truncate", "leading-7");
    }
  });

  it("shows four skeleton bars while loading", () => {
    lyricsStore.status = "loading";
    const { container } = renderCard();

    expect(screen.getByText("Lyrics").closest("section"))
      .toHaveStyle({ backgroundColor: tintedSurface(COVER_COLOR).background });
    const bars = container.querySelectorAll("[data-slot='skeleton']");
    expect(bars).toHaveLength(4);
    for (const bar of Array.from(bars)) {
      expect(bar).toHaveClass("h-5", "bg-white/16");
    }
  });

  it("offers Add lyrics on a neutral card when an attachable track has none", async () => {
    attachableTrack.value = track;
    renderCard();

    const title = screen.getByText("No lyrics for this track");
    expect(title.closest("section")).toHaveClass("bg-muted");
    expect(screen.getByText("Write or paste the lyrics, or attach an .lrc file.")).toBeInTheDocument();
    expect(screen.queryByText("Lyrics")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Add lyrics" }));
    expect(useRightPanelStore().view).toBe("lyrics");

    showLyrics(linesOf(["", "  "]), 1);
    await nextTick();
    expect(screen.getByText("No lyrics for this track")).toBeInTheDocument();
  });

  it("renders nothing when the track has no lyrics and cannot get any", async () => {
    const { container } = renderCard();

    expect(container.querySelector("section")).toBeNull();

    showLyrics(linesOf([""]), 0);
    await nextTick();
    expect(container.querySelector("section")).toBeNull();
  });

  it("retries the load from the error card", async () => {
    lyricsStore.status = "error";
    renderCard();

    expect(screen.getByText("Couldn't load lyrics").closest("section")).toHaveClass("bg-muted");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(lyricsStore.loadFor).toHaveBeenCalledTimes(1);
    expect(lyricsStore.loadFor).toHaveBeenCalledWith(track);
  });

  it("opens the lyrics panel from Show lyrics", async () => {
    showLyrics(numbered(6), 2);
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Show lyrics" }));

    const rightPanel = useRightPanelStore();
    expect(rightPanel.isOpen).toBe(true);
    expect(rightPanel.view).toBe("lyrics");
  });
});
