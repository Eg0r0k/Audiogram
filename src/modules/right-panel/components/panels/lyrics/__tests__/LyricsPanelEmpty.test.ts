import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import type { LyricsFailure } from "@/modules/player/service/track-lyrics-loader.service";
import type { EphemeralTrack, PlayerTrack, Track } from "@/modules/player/types";

const actions = vi.hoisted(() => ({ attachFile: vi.fn(), removeMissing: vi.fn() }));
const lyrics = vi.hoisted(() => ({ reload: vi.fn() }));
const importCurrent = vi.hoisted(() => vi.fn());

vi.mock("@/modules/player/composables/useLyricsActions", async () => {
  const { ref } = await import("vue");
  return { useLyricsActions: () => ({ ...actions, isPending: ref(false) }) };
});
vi.mock("@/modules/player/store/lyrics.store", () => ({ useLyricsStore: () => lyrics }));
vi.mock("@/modules/tracks/composables/useEphemeralImport", async () => {
  const { computed, ref, toValue } = await import("vue");
  const { ephemeralFilePath } = await import("@/modules/tracks/lib/trackPredicates");
  return {
    useEphemeralImport: (track: unknown) => ({
      importPath: computed(() => ephemeralFilePath(toValue(track) as PlayerTrack | null)),
      isRunning: ref(false),
      importCurrent,
    }),
  };
});

import LyricsPanelEmpty from "../LyricsPanelEmpty.vue";

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

const openedFile: EphemeralTrack = {
  kind: "ephemeral",
  id: "eph-1",
  title: "Opened",
  artist: "Someone",
  source: { type: "path", path: "C:/Music/opened.flac" },
};

const stream: EphemeralTrack = {
  kind: "ephemeral",
  id: "yt-1",
  title: "Stream",
  artist: "Someone",
  source: { type: "url", url: "https://example.com/a.m3u8" },
};

const renderEmpty = (subject: PlayerTrack, reason: LyricsFailure | null = null) =>
  render(LyricsPanelEmpty, { props: { track: subject, reason }, global: { plugins: [i18n] } });

const buttons = () => screen.queryAllByRole("button").map(button => button.textContent?.trim());

describe("LyricsPanelEmpty", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.clearAllMocks();
    actions.attachFile.mockResolvedValue(null);
    actions.removeMissing.mockResolvedValue(undefined);
    lyrics.reload.mockResolvedValue(undefined);
  });

  it("offers Write lyrics and Attach file when a library track has no lyrics", async () => {
    const { container, emitted } = renderEmpty(track);

    expect(screen.getByText("No lyrics for this track")).toBeInTheDocument();
    expect(screen.getByText("Nothing found on LRCLIB. Write or paste the lyrics, or attach an .lrc file.")).toBeInTheDocument();
    expect(container.querySelector("[data-slot='empty-media']")).toBeNull();
    expect(buttons()).toEqual(["Write lyrics", "Attach file"]);

    await userEvent.click(screen.getByRole("button", { name: "Write lyrics" }));
    expect(emitted().write).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Attach file" }));
    expect(actions.attachFile).toHaveBeenCalledWith(track);
  });

  it("offers Add to library when a track outside the library has no lyrics", async () => {
    renderEmpty(openedFile);

    expect(screen.getByText("No lyrics found")).toBeInTheDocument();
    expect(screen.getByText("LRCLIB has nothing for this track. Add it to your library to write or attach lyrics.")).toBeInTheDocument();
    expect(buttons()).toEqual(["Add to library"]);

    await userEvent.click(screen.getByRole("button", { name: "Add to library" }));
    expect(importCurrent).toHaveBeenCalledTimes(1);
  });

  it("hides Add to library when the track has no file to import", () => {
    renderEmpty(stream);

    expect(screen.getByText("No lyrics found")).toBeInTheDocument();
    expect(screen.getByText("LRCLIB has nothing for this track.")).toBeInTheDocument();
    expect(screen.queryByText(/Add it to your library/)).toBeNull();
    expect(buttons()).toEqual([]);
  });

  it("explains a missing lyrics file and offers to attach it again or remove the lyrics", async () => {
    const attached = { ...track, lyricsPath: "lyrics/t1.lrc", lyricsFileName: "Song.lrc" };
    const { unmount } = renderEmpty(attached, "file-missing");

    expect(screen.getByText("Lyrics file not found")).toBeInTheDocument();
    expect(screen.getByText("Song.lrc was moved or deleted. Attach it again or remove the lyrics from the track.")).toBeInTheDocument();
    expect(buttons()).toEqual(["Attach file", "Remove lyrics"]);
    expect(screen.getByRole("button", { name: "Remove lyrics" })).toHaveAttribute("data-color", "destructive");

    await userEvent.click(screen.getByRole("button", { name: "Attach file" }));
    expect(actions.attachFile).toHaveBeenCalledWith(attached);

    await userEvent.click(screen.getByRole("button", { name: "Remove lyrics" }));
    expect(actions.removeMissing).toHaveBeenCalledWith(attached);
    unmount();

    renderEmpty({ ...attached, lyricsFileName: undefined }, "file-missing");

    expect(screen.getByText("The lyrics file was moved or deleted. Attach it again or remove the lyrics from the track.")).toBeInTheDocument();
  });

  it("offers Try again when LRCLIB is unreachable", async () => {
    const { emitted, unmount } = renderEmpty(track, "network");

    expect(screen.getByText("Couldn't reach LRCLIB")).toBeInTheDocument();
    expect(screen.getByText("Check the connection and try again, or write the lyrics yourself.")).toBeInTheDocument();
    expect(buttons()).toEqual(["Try again", "Write lyrics"]);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(lyrics.reload).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Write lyrics" }));
    expect(emitted().write).toHaveLength(1);
    unmount();

    renderEmpty(stream, "network");

    expect(buttons()).toEqual(["Try again"]);
  });
});
