import { beforeEach, describe, expect, it, vi } from "vitest";
import { okAsync } from "neverthrow";
import { createApp, effectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises } from "@vue/test-utils";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/types/track";
import type { TrackLyricsLoadResult } from "@/modules/player/service/track-lyrics-loader.service";

const caps = vi.hoisted(() => ({ hasFs: false }));
const openDialog = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => ({ saveFile: vi.fn(), importFile: vi.fn() }));
const attachTrackLyricsAndSync = vi.hoisted(() => vi.fn());
const loadTrackLyrics = vi.hoisted(() => vi.fn());
const player = vi.hoisted(() => ({ currentTrack: null as Track | null, currentTime: 0 }));
// The queue hands an edit to the playing track over to the player, as presentTrack does.
const queue = vi.hoisted(() => ({
  syncTrackMetadata: vi.fn((next: Track) => {
    if (player.currentTrack?.id === next.id) player.currentTrack = next;
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog }));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: caps }));
vi.mock("@/db/storage", () => ({ storageService: storage }));
vi.mock("@/queries/track.queries", () => ({ attachTrackLyricsAndSync }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));
vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => player }));
vi.mock("@/modules/player/service/track-lyrics-loader.service", () => ({ loadTrackLyrics }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/app/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { useAttachTrackLyrics } from "../useAttachTrackLyrics";

const libraryTrack = (overrides: Partial<Track> = {}): Track => ({
  kind: "library",
  id: "track-1" as Track["id"],
  title: "Song",
  artist: "Artist",
  artistIds: [],
  albumId: "" as Track["albumId"],
  albumName: "",
  storagePath: "tracks/track-1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
  ...overrides,
});

const attachedLyrics: TrackLyricsLoadResult = {
  status: "ready",
  lyrics: { kind: "synced", lines: [{ time: 1, text: "Attached" }] },
  raw: "[00:01.00]Attached",
  source: { type: "file", fileName: "Song.lrc" },
};

// The browser picker appends a hidden input and clicks it; this answers it with `file`.
const pickInBrowser = (file: File) => {
  vi.spyOn(document.body, "append").mockImplementationOnce((...nodes) => {
    const input = nodes[0] as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file] });
    queueMicrotask(() => input.dispatchEvent(new Event("change")));
  });
};

const setup = () => {
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient: new QueryClient() });
  const scope = effectScope();
  let api!: ReturnType<typeof useAttachTrackLyrics>;
  app.runWithContext(() => {
    scope.run(() => {
      api = useAttachTrackLyrics();
    });
  });
  return api;
};

describe("useAttachTrackLyrics", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    caps.hasFs = false;
    player.currentTrack = null;
    storage.saveFile.mockImplementation((path: string) => okAsync(path));
    storage.importFile.mockImplementation((_source: string, target: string) => okAsync(target));
    attachTrackLyricsAndSync.mockImplementation(async (
      _client: unknown,
      track: Track,
      lyrics: { lyricsPath: string; lyricsFileName: string | null; lyricsOffsetMs?: number },
    ) => ({ ...track, lyricsPath: lyrics.lyricsPath, lyricsFileName: lyrics.lyricsFileName ?? undefined, lyricsOffsetMs: lyrics.lyricsOffsetMs }));
  });

  it("reloads the lyrics of the playing track after a file is attached", async () => {
    const playing = libraryTrack();
    player.currentTrack = playing;
    const lyricsStore = useLyricsStore();
    loadTrackLyrics.mockResolvedValueOnce({ status: "idle" });
    await lyricsStore.loadFor(playing);
    expect(lyricsStore.status).toBe("idle");

    loadTrackLyrics.mockResolvedValueOnce(attachedLyrics);
    pickInBrowser(new File(["[00:01.00]Attached"], "Song.lrc"));
    const { attachTrackLyrics } = setup();
    await attachTrackLyrics(playing);
    await flushPromises();

    expect(loadTrackLyrics).toHaveBeenCalledTimes(2);
    expect(loadTrackLyrics).toHaveBeenLastCalledWith(expect.objectContaining({ id: "track-1", lyricsPath: "lyrics/track-1.lrc" }));
    expect(lyricsStore.status).toBe("ready");
    expect(lyricsStore.lines).toEqual([{ time: 1, text: "Attached" }]);

    pickInBrowser(new File(["[00:01.00]Other"], "Other.lrc"));
    await attachTrackLyrics(libraryTrack({ id: "track-2" as Track["id"] }));
    await flushPromises();

    expect(loadTrackLyrics).toHaveBeenCalledTimes(2);
  });

  it("stores the picked file name and resets the offset", async () => {
    const track = libraryTrack({ lyricsPath: "lyrics/track-1.lrc", lyricsFileName: "Old.lrc", lyricsOffsetMs: 1200 });
    pickInBrowser(new File(["[00:01.00]New"], "New song.lrc"));
    const { attachTrackLyrics } = setup();

    await attachTrackLyrics(track);

    expect(storage.saveFile).toHaveBeenCalledWith("lyrics/track-1.lrc", expect.any(File));
    expect(attachTrackLyricsAndSync).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "track-1" }),
      { lyricsPath: "lyrics/track-1.lrc", lyricsFileName: "New song.lrc", lyricsOffsetMs: 0 },
    );
    expect(track).toMatchObject({ lyricsFileName: "New song.lrc", lyricsOffsetMs: 0 });

    caps.hasFs = true;
    openDialog.mockResolvedValueOnce("C:\\Users\\me\\Lyrics\\Song (live).lrc");

    await attachTrackLyrics(track);

    expect(storage.importFile).toHaveBeenCalledWith("C:\\Users\\me\\Lyrics\\Song (live).lrc", "lyrics/track-1.lrc");
    expect(attachTrackLyricsAndSync).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "track-1" }),
      { lyricsPath: "lyrics/track-1.lrc", lyricsFileName: "Song (live).lrc", lyricsOffsetMs: 0 },
    );
  });
});
