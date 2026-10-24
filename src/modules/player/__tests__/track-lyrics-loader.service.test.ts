import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import { StorageError } from "@/db/errors/storage.errors";
import type { PlayerTrack, Track } from "../types";
import { loadTrackLyrics } from "../service/track-lyrics-loader.service";
import { fetchLrcLibLyrics } from "../service/lyrics.service";
import { storageService } from "@/db/storage";

vi.mock("@/db/storage", () => ({
  storageService: {
    getFile: vi.fn(),
  },
}));

vi.mock("../service/lyrics.service", () => ({
  fetchLrcLibLyrics: vi.fn(),
}));

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    kind: "library",
    id: "track-1" as Track["id"],
    title: "Test Track",
    artist: "Test Artist",
    artistIds: ["artist-1" as Track["artistIds"][number]],
    albumId: "album-1" as Track["albumId"],
    albumName: "Test Album",
    storagePath: "tracks/track-1.mp3",
    source: TrackSource.LOCAL_INTERNAL,
    state: TrackState.READY,
    duration: 120,
    isLiked: false,
    ...overrides,
  };
}

describe("loadTrackLyrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns idle for non-library tracks", async () => {
    const result = await loadTrackLyrics({
      kind: "ephemeral",
      id: "stream-1",
      title: "Stream",
      source: { type: "url", url: "https://example.com/stream.m3u8" },
    } satisfies PlayerTrack);

    expect(result).toEqual({ status: "idle" });
    expect(storageService.getFile).not.toHaveBeenCalled();
    expect(fetchLrcLibLyrics).not.toHaveBeenCalled();
  });

  it("loads and parses attached LRC lyrics", async () => {
    const raw = "[00:01.00]Hello\n[00:02.50]World";
    vi.mocked(storageService.getFile).mockResolvedValue(ok(new Blob([raw])));

    const result = await loadTrackLyrics(createTrack({ lyricsPath: "lyrics/track-1.lrc" }));

    expect(storageService.getFile).toHaveBeenCalledWith("lyrics/track-1.lrc");
    expect(result).toEqual({
      status: "ready",
      lyrics: {
        kind: "synced",
        lines: [
          { time: 1, text: "Hello" },
          { time: 2.5, text: "World" },
        ],
      },
      raw,
      source: { type: "file", fileName: null },
    });
    expect(fetchLrcLibLyrics).not.toHaveBeenCalled();
  });

  it("reports file-missing when the attached file is gone", async () => {
    vi.mocked(storageService.getFile).mockResolvedValue(err(StorageError.fileNotFound("lyrics/missing.lrc")));

    const result = await loadTrackLyrics(createTrack({ lyricsPath: "lyrics/missing.lrc" }));

    expect(result).toEqual({ status: "error", reason: "file-missing" });

    const unreadable = new Blob(["x"]);
    vi.spyOn(unreadable, "text").mockRejectedValue(new Error("read failed"));
    vi.mocked(storageService.getFile).mockResolvedValue(ok(unreadable));

    expect(await loadTrackLyrics(createTrack({ lyricsPath: "lyrics/track-1.lrc" })))
      .toEqual({ status: "error", reason: "file-missing" });
    expect(fetchLrcLibLyrics).not.toHaveBeenCalled();
  });

  it("treats an attached file without a single lyrics line as no lyrics", async () => {
    vi.mocked(storageService.getFile).mockResolvedValue(ok(new Blob(["[ar:Artist]\n\n  \n"])));

    const result = await loadTrackLyrics(createTrack({ lyricsPath: "lyrics/track-1.lrc" }));

    expect(result).toEqual({ status: "idle" });
  });

  it("returns the attached file name as the source", async () => {
    vi.mocked(storageService.getFile).mockResolvedValue(ok(new Blob(["Plain line"])));

    const result = await loadTrackLyrics(createTrack({ lyricsPath: "lyrics/track-1.lrc", lyricsFileName: "Song (live).lrc" }));

    expect(result).toEqual({
      status: "ready",
      lyrics: { kind: "plain", lines: ["Plain line"] },
      raw: "Plain line",
      source: { type: "file", fileName: "Song (live).lrc" },
    });
  });

  it("falls back to lrclib when no local lyrics are attached", async () => {
    const lyrics = { kind: "synced" as const, lines: [{ time: 10, text: "Remote line" }] };
    vi.mocked(fetchLrcLibLyrics).mockResolvedValue(ok({ raw: "[00:10.00]Remote line", lyrics }));

    const result = await loadTrackLyrics(createTrack());

    expect(fetchLrcLibLyrics).toHaveBeenCalledWith("Test Track", "Test Artist");
    expect(result).toEqual({ status: "ready", lyrics, raw: "[00:10.00]Remote line", source: { type: "lrclib" } });
  });

  it("returns plain lyrics from LRCLIB with their source", async () => {
    const lyrics = { kind: "plain" as const, lines: ["Remote", "", "Verse two"] };
    vi.mocked(fetchLrcLibLyrics).mockResolvedValue(ok({ raw: "Remote\n\nVerse two", lyrics }));

    const result = await loadTrackLyrics({
      kind: "ephemeral",
      id: "yt-1",
      title: "Stream",
      artist: "Streamer",
      source: { type: "url", url: "https://example.com/stream" },
    });

    expect(result).toEqual({ status: "ready", lyrics, raw: "Remote\n\nVerse two", source: { type: "lrclib" } });
  });

  it("maps lrclib not-found responses to idle", async () => {
    vi.mocked(fetchLrcLibLyrics).mockResolvedValue(err({ type: "NOT_FOUND" }));

    const result = await loadTrackLyrics(createTrack());

    expect(result).toEqual({ status: "idle" });
  });

  it("reports network when LRCLIB is unreachable", async () => {
    vi.mocked(fetchLrcLibLyrics).mockResolvedValue(err({ type: "NETWORK", cause: new Error("offline") }));

    const result = await loadTrackLyrics(createTrack());

    expect(result).toEqual({ status: "error", reason: "network" });
  });
});
