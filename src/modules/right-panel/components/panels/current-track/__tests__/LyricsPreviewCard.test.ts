import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import { tintedSurface } from "@/lib/color/tinted-surface";
import type { LyricsLine } from "@/modules/player/lib/lrc";
import type { TrackLyricsLoadResult } from "@/modules/player/service/track-lyrics-loader.service";
import type { EphemeralTrack, PlayerTrack, Track } from "@/modules/player/types";

const mockPlayerState = reactive({
  currentTime: 0,
  currentTrack: null as PlayerTrack | null,
  canSeek: true,
  seekTo: vi.fn(),
});

vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => mockPlayerState }));
vi.mock("@/modules/player/service/track-lyrics-loader.service", () => ({ loadTrackLyrics: vi.fn() }));

import { loadTrackLyrics } from "@/modules/player/service/track-lyrics-loader.service";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import LyricsPreviewCard from "../LyricsPreviewCard.vue";

const loader = vi.mocked(loadTrackLyrics);

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

const stream: EphemeralTrack = {
  kind: "ephemeral",
  id: "yt-1",
  title: "Stream",
  artist: "Someone",
  source: { type: "url", url: "https://example.com/a.m3u8" },
};

const linesOf = (texts: string[]): LyricsLine[] => texts.map((text, i) => ({ time: (i + 1) * 5, text }));

const numbered = (count: number) => linesOf(Array.from({ length: count }, (_, i) => `Line ${i}`));

const timeOf = (lines: LyricsLine[], index: number) => (index < 0 ? 0 : lines[index].time + 0.1);

const load = async (result: TrackLyricsLoadResult, playing: PlayerTrack = track) => {
  mockPlayerState.currentTrack = playing;
  loader.mockResolvedValueOnce(result);
  await useLyricsStore().loadFor(playing, { force: true });
};

const showLyrics = async (lines: LyricsLine[], activeLineIndex: number, playing: PlayerTrack = track) => {
  mockPlayerState.currentTime = timeOf(lines, activeLineIndex);
  await load({ status: "ready", lyrics: { kind: "synced", lines }, raw: "", source: { type: "lrclib" } }, playing);
};

const COVER_COLOR = "#3366cc";

const renderCard = () => render(LyricsPreviewCard, {
  props: { coverColor: COVER_COLOR },
  global: { plugins: [i18n] },
});

const shownRows = () => {
  const block = screen.getByText("Lyrics").closest("section")?.querySelector(".h-28");
  return Array.from(block?.children ?? []);
};

const shownLines = () => shownRows().map(row => row.textContent?.trim());

const currentLine = () => document.querySelector("[aria-current='true']")?.textContent?.trim() ?? null;

describe("LyricsPreviewCard", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    setActivePinia(createPinia());
    loader.mockReset();
    mockPlayerState.currentTime = 0;
    mockPlayerState.currentTrack = track;
  });

  it("shows four lines around the active one: one sung, the current, two ahead", async () => {
    await showLyrics(numbered(10), 5);
    renderCard();

    expect(shownLines()).toEqual(["Line 4", "Line 5", "Line 6", "Line 7"]);
    expect(currentLine()).toBe("Line 5");
  });

  it("skips blank verse separators", async () => {
    await showLyrics(linesOf(["Line 0", "", "Line 1", "Line 2", "", "Line 3", "Line 4"]), 4);
    renderCard();

    expect(shownLines()).toEqual(["Line 1", "Line 2", "Line 3", "Line 4"]);
    expect(currentLine()).toBe("Line 2");
  });

  it("shows the first four lines before the first one starts and the last four at the end", async () => {
    const lines = numbered(10);
    await showLyrics(lines, -1);
    renderCard();

    expect(shownLines()).toEqual(["Line 0", "Line 1", "Line 2", "Line 3"]);
    expect(currentLine()).toBeNull();

    mockPlayerState.currentTime = timeOf(lines, 9);
    await vi.waitFor(() => expect(shownLines()).toEqual(["Line 6", "Line 7", "Line 8", "Line 9"]));
    expect(currentLine()).toBe("Line 9");
  });

  it("keeps a fixed-height block with truncated lines", async () => {
    await showLyrics(numbered(2), 0);
    renderCard();

    const line = screen.getByText("Line 0");
    expect(line.parentElement).toHaveClass("h-28");
    expect(shownLines()).toEqual(["Line 0", "Line 1"]);
    for (const row of Array.from(line.parentElement!.children)) {
      expect(row).toHaveClass("truncate", "leading-7");
    }
  });

  it("shows four skeleton bars while loading", () => {
    loader.mockReturnValueOnce(new Promise(() => {}));
    void useLyricsStore().loadFor(track, { force: true });
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
    await load({ status: "idle" });
    renderCard();

    const title = screen.getByText("No lyrics for this track");
    expect(title.closest("section")).toHaveClass("bg-muted");
    expect(screen.getByText("Write or paste the lyrics, or attach an .lrc file.")).toBeInTheDocument();
    expect(screen.queryByText("Lyrics")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Add lyrics" }));
    expect(useRightPanelStore().view).toBe("lyrics");

    await showLyrics(linesOf(["", "  "]), 1);
    await nextTick();
    expect(screen.getByText("No lyrics for this track")).toBeInTheDocument();
  });

  it("renders nothing when the track has no lyrics and cannot get any", async () => {
    await load({ status: "idle" }, stream);
    const { container } = renderCard();

    expect(container.querySelector("section")).toBeNull();

    await showLyrics(linesOf([""]), 0, stream);
    await nextTick();
    expect(container.querySelector("section")).toBeNull();
  });

  it("retries the load from the error card", async () => {
    await load({ status: "error", reason: "network" });
    renderCard();

    expect(screen.getByText("Couldn't load lyrics").closest("section")).toHaveClass("bg-muted");
    loader.mockResolvedValueOnce({ status: "idle" });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flushPromises();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenLastCalledWith(track);
  });

  it("opens the lyrics panel from Show lyrics", async () => {
    await showLyrics(numbered(6), 2);
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Show lyrics" }));

    const rightPanel = useRightPanelStore();
    expect(rightPanel.isOpen).toBe(true);
    expect(rightPanel.view).toBe("lyrics");
  });

  it("shows the first four lines of plain lyrics, none current", async () => {
    mockPlayerState.currentTime = 120;
    await load({
      status: "ready",
      lyrics: { kind: "plain", lines: ["First", "Second", "", "Third", "Fourth", "Fifth"] },
      raw: "First\nSecond\n\nThird\nFourth\nFifth",
      source: { type: "lrclib" },
    });
    renderCard();

    expect(shownLines()).toEqual(["First", "Second", "Third", "Fourth"]);
    expect(currentLine()).toBeNull();
    for (const row of shownRows()) {
      expect(row).not.toHaveClass("text-white");
    }
  });

  it("follows the saved lyrics offset", async () => {
    const lines = numbered(10);
    const shifted: Track = { ...track, lyricsOffsetMs: 2000 };
    mockPlayerState.currentTime = 31;
    await load({ status: "ready", lyrics: { kind: "synced", lines }, raw: "", source: { type: "lrclib" } }, shifted);
    renderCard();

    expect(currentLine()).toBe("Line 4");
    expect(shownLines()).toEqual(["Line 3", "Line 4", "Line 5", "Line 6"]);

    mockPlayerState.currentTrack = { ...shifted, lyricsOffsetMs: -4000 };
    await nextTick();

    expect(currentLine()).toBe("Line 6");
  });
});
