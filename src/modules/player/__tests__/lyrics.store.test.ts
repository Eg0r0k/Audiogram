import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type { LyricsLine } from "../lib/lrc";
import type { TrackLyricsLoadResult } from "../service/track-lyrics-loader.service";
import type { PlayerTrack, Track } from "@/types/track";

const mockPlayerState = reactive({ currentTime: 0, currentTrack: null as PlayerTrack | null });

vi.mock("../store/player.store", () => ({ usePlayerStore: () => mockPlayerState }));
vi.mock("../service/track-lyrics-loader.service", () => ({
  loadTrackLyrics: vi.fn(),
}));

import { useLyricsStore } from "../store/lyrics.store";
import { loadTrackLyrics } from "../service/track-lyrics-loader.service";

const loader = vi.mocked(loadTrackLyrics);

function createLibraryTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    kind: "library",
    title: "Test Track",
    ...overrides,
  } as unknown as Track;
}

const synced = (lines: LyricsLine[]): TrackLyricsLoadResult => ({
  status: "ready",
  lyrics: { kind: "synced", lines },
  raw: lines.map(line => line.text).join("\n"),
  source: { type: "lrclib" },
});

const THREE_LINES: LyricsLine[] = [
  { time: 0, text: "one" },
  { time: 10, text: "two" },
  { time: 20, text: "three" },
];

describe("lyrics.store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockPlayerState.currentTime = 0;
    mockPlayerState.currentTrack = null;
  });

  it("starts idle and empty", () => {
    const store = useLyricsStore();

    expect(store.lines).toEqual([]);
    expect(store.plainLines).toEqual([]);
    expect(store.status).toBe("idle");
    expect(store.kind).toBeNull();
    expect(store.reason).toBeNull();
    expect(store.activeLineIndex).toBe(-1);
    expect(store.offsetMs).toBe(0);
  });

  it("shows loading for library tracks, then the loader result", async () => {
    const store = useLyricsStore();
    let resolve!: (v: TrackLyricsLoadResult) => void;
    loader.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));

    const pending = store.loadFor(createLibraryTrack());
    expect(store.status).toBe("loading");

    resolve(synced([{ time: 0, text: "line" }]));
    await pending;

    expect(store.status).toBe("ready");
    expect(store.lines).toHaveLength(1);
  });

  it("clears to idle when playback is cleared", async () => {
    const store = useLyricsStore();
    loader.mockResolvedValueOnce({ status: "idle" });

    await store.loadFor(null);

    expect(store.status).toBe("idle");
    expect(store.lines).toEqual([]);
  });

  it("ignores a stale load finishing after a newer one", async () => {
    const store = useLyricsStore();

    let resolveFirst!: (v: TrackLyricsLoadResult) => void;
    loader.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    const first = store.loadFor(createLibraryTrack());

    loader.mockResolvedValueOnce(synced([{ time: 0, text: "new" }]));
    await store.loadFor(createLibraryTrack({ id: "track-2" as Track["id"] }));

    resolveFirst(synced([{ time: 0, text: "stale" }]));
    await first;

    expect(store.lines).toEqual([{ time: 0, text: "new" }]);
  });

  it("does not reload lyrics already held for the same track", async () => {
    const store = useLyricsStore();
    loader.mockResolvedValue(synced([{ time: 0, text: "line" }]));
    await store.loadFor(createLibraryTrack());

    // A cold start or a repeat-one loop announces the same track again.
    await store.loadFor(createLibraryTrack());

    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.lines).toHaveLength(1);
  });

  it("reloads when the same track gains a lyrics file or the last load failed", async () => {
    const store = useLyricsStore();
    loader.mockResolvedValueOnce({ status: "error", reason: "network" });
    await store.loadFor(createLibraryTrack());
    expect(store.reason).toBe("network");
    loader.mockResolvedValueOnce(synced([{ time: 0, text: "retry" }]));
    await store.loadFor(createLibraryTrack());
    expect(loader).toHaveBeenCalledTimes(2);
    expect(store.reason).toBeNull();

    loader.mockResolvedValueOnce(synced([{ time: 0, text: "attached" }]));
    await store.loadFor(createLibraryTrack({ lyricsPath: "lyrics/track-1.lrc" }));
    expect(loader).toHaveBeenCalledTimes(3);
    expect(store.lines).toEqual([{ time: 0, text: "attached" }]);
  });

  it("tracks the active line against player time", async () => {
    const store = useLyricsStore();
    loader.mockResolvedValueOnce(synced(THREE_LINES));
    await store.loadFor(createLibraryTrack());

    mockPlayerState.currentTime = 12;
    expect(store.activeLineIndex).toBe(1);
  });

  it("shifts the active line by the track's lyrics offset", async () => {
    const track = createLibraryTrack({ lyricsOffsetMs: 2500 });
    mockPlayerState.currentTrack = track;
    const store = useLyricsStore();
    loader.mockResolvedValueOnce(synced(THREE_LINES));
    await store.loadFor(track);

    mockPlayerState.currentTime = 12;
    expect(store.offsetMs).toBe(2500);
    expect(store.activeLineIndex).toBe(0);

    mockPlayerState.currentTime = 12.5;
    expect(store.activeLineIndex).toBe(1);
  });

  it("lets a preview offset override the saved one", async () => {
    const track = createLibraryTrack({ lyricsOffsetMs: 2500 });
    mockPlayerState.currentTrack = track;
    const store = useLyricsStore();
    loader.mockResolvedValueOnce(synced(THREE_LINES));
    await store.loadFor(track);
    mockPlayerState.currentTime = 8;

    store.setPreviewOffset(-3000);

    expect(store.offsetMs).toBe(-3000);
    expect(store.activeLineIndex).toBe(1);

    store.setPreviewOffset(null);

    expect(store.offsetMs).toBe(2500);
    expect(store.activeLineIndex).toBe(0);
  });

  it("drops the preview offset when the track changes", async () => {
    const first = createLibraryTrack({ lyricsOffsetMs: 2500 });
    mockPlayerState.currentTrack = first;
    const store = useLyricsStore();
    loader.mockResolvedValue(synced(THREE_LINES));
    await store.loadFor(first);
    store.setPreviewOffset(1000);

    await store.loadFor(first);
    expect(store.offsetMs).toBe(1000);

    const second = createLibraryTrack({ id: "track-2" as Track["id"] });
    mockPlayerState.currentTrack = second;
    await store.loadFor(second);

    expect(store.offsetMs).toBe(0);
  });

  it("reloads the same track on reload() even when its lyrics path did not change", async () => {
    const track = createLibraryTrack({ lyricsPath: "lyrics/track-1.lrc" });
    mockPlayerState.currentTrack = track;
    const store = useLyricsStore();
    loader.mockResolvedValueOnce(synced([{ time: 0, text: "old file" }]));
    await store.loadFor(track);
    await store.loadFor(track);
    expect(loader).toHaveBeenCalledTimes(1);

    loader.mockResolvedValueOnce(synced([{ time: 0, text: "new file" }]));
    await store.reload();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenLastCalledWith(track);
    expect(store.lines).toEqual([{ time: 0, text: "new file" }]);
  });

  it("exposes kind, raw text and source of the loaded lyrics", async () => {
    const store = useLyricsStore();
    loader.mockResolvedValueOnce({
      status: "ready",
      lyrics: { kind: "synced", lines: [{ time: 1, text: "Hello" }] },
      raw: "[ti:Song]\n[00:01.00]Hello",
      source: { type: "file", fileName: "Song.lrc" },
    });

    await store.loadFor(createLibraryTrack({ lyricsPath: "lyrics/track-1.lrc" }));

    expect(store.kind).toBe("synced");
    expect(store.raw).toBe("[ti:Song]\n[00:01.00]Hello");
    expect(store.source).toEqual({ type: "file", fileName: "Song.lrc" });
    expect(store.lines).toEqual([{ time: 1, text: "Hello" }]);
    expect(store.plainLines).toEqual([]);
  });

  it("has no active line for plain lyrics", async () => {
    const store = useLyricsStore();
    loader.mockResolvedValueOnce({
      status: "ready",
      lyrics: { kind: "plain", lines: ["First", "", "Second"] },
      raw: "First\n\nSecond",
      source: { type: "lrclib" },
    });

    await store.loadFor(createLibraryTrack());
    mockPlayerState.currentTime = 100;

    expect(store.kind).toBe("plain");
    expect(store.plainLines).toEqual(["First", "", "Second"]);
    expect(store.lines).toEqual([]);
    expect(store.activeLineIndex).toBe(-1);
  });
});
