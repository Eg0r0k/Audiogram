import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { TrackLyricsLoadResult } from "@/modules/player/service/track-lyrics-loader.service";
import type { PlayerTrack, Track } from "@/types/track";

const mockPlayerState = reactive({
  currentTime: 0,
  currentTrack: null as PlayerTrack | null,
  canSeek: true,
  seekTo: vi.fn(),
});

vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => mockPlayerState }));
vi.mock("@/modules/player/service/track-lyrics-loader.service", () => ({
  loadTrackLyrics: vi.fn(),
}));

import { loadTrackLyrics } from "@/modules/player/service/track-lyrics-loader.service";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import FullscreenLyrics from "../FullscreenLyrics.vue";

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

const play = async (result: TrackLyricsLoadResult, playing: Track = track) => {
  mockPlayerState.currentTrack = playing;
  loader.mockResolvedValueOnce(result);
  await useLyricsStore().loadFor(playing);
};

const renderLyrics = () => render(FullscreenLyrics, { global: { plugins: [i18n] } });

describe("FullscreenLyrics", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    mockPlayerState.currentTime = 0;
    mockPlayerState.currentTrack = null;
    mockPlayerState.canSeek = true;
  });

  it("shows the skeleton while loading", () => {
    mockPlayerState.currentTrack = track;
    loader.mockImplementationOnce(() => new Promise(() => {}));
    void useLyricsStore().loadFor(track);

    const { container } = renderLyrics();

    const bars = container.querySelectorAll("[data-slot='skeleton']");
    expect(bars).toHaveLength(7);
    for (const bar of Array.from(bars)) {
      expect(bar).toHaveClass("mx-auto", "h-5", "sm:h-7");
    }
    expect(container.querySelector("[data-slot='lyrics-line']")).toBeNull();
  });

  it("shows a single quiet line without buttons when there are no lyrics", async () => {
    await play({ status: "idle" });
    const { container, unmount } = renderLyrics();

    const line = screen.getByText("No lyrics for this track");
    expect(line).toHaveClass("text-muted-foreground");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelector("svg")).toBeNull();
    unmount();

    await play({ status: "error", reason: "network" }, { ...track, id: "t2" as Track["id"] });
    renderLyrics();

    expect(screen.getByText("No lyrics for this track")).toHaveClass("text-muted-foreground");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows plain lyrics as a list", async () => {
    await play({
      status: "ready",
      lyrics: { kind: "plain", lines: ["First", "", "Second", "Third"] },
      raw: "First\n\nSecond\nThird",
      source: { type: "lrclib" },
    });
    const { container } = renderLyrics();

    const lines = Array.from(container.querySelectorAll("[data-slot='lyrics-line']"));
    expect(lines.map(line => line.textContent?.trim())).toEqual(["First", "Second", "Third"]);
    expect(container.querySelectorAll("[data-slot='lyrics-verse']")).toHaveLength(2);
    for (const line of lines) {
      expect(line.tagName).toBe("P");
      expect(line).toHaveClass("text-center", "text-xl", "sm:text-2xl", "leading-relaxed");
    }
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText("No lyrics for this track")).toBeNull();
  });

  it("seeks with the lyrics offset applied", async () => {
    await play({
      status: "ready",
      lyrics: { kind: "synced", lines: [{ time: 10, text: "One" }, { time: 20, text: "Two" }] },
      raw: "[00:10.00]One\n[00:20.00]Two",
      source: { type: "file", fileName: "Song.lrc" },
    }, { ...track, lyricsOffsetMs: 500 });
    renderLyrics();

    await userEvent.click(screen.getByRole("button", { name: "Two" }));

    expect(mockPlayerState.seekTo).toHaveBeenCalledTimes(1);
    expect(mockPlayerState.seekTo).toHaveBeenCalledWith(20.5);
  });
});
