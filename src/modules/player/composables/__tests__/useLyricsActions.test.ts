import { beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import { createApp, effectScope } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises } from "@vue/test-utils";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { shownToasts } from "@/test/toasts";

const storage = vi.hoisted(() => ({ saveFile: vi.fn() }));
const queries = vi.hoisted(() => ({
  attachTrackLyricsAndSync: vi.fn(),
  detachTrackLyricsAndSync: vi.fn(),
  setTrackLyricsOffsetAndSync: vi.fn(),
  getTrackEntityById: vi.fn(),
}));
const files = vi.hoisted(() => ({ deleteOwnedLyricsFile: vi.fn() }));
const lyrics = vi.hoisted(() => ({ reload: vi.fn() }));
const player = vi.hoisted(() => ({ currentTrack: null as Track | null }));
const queue = vi.hoisted(() => ({ syncTrackMetadata: vi.fn() }));
const attach = vi.hoisted(() => ({ attachTrackLyrics: vi.fn() }));
const feedback = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@/db/storage", () => ({ storageService: storage }));
vi.mock("@/queries/track.queries", () => queries);
vi.mock("@/services/track-files", () => files);
vi.mock("@/modules/player/store/lyrics.store", () => ({ useLyricsStore: () => lyrics }));
vi.mock("@/modules/player/store/player.store", () => ({ usePlayerStore: () => player }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => queue }));
vi.mock("@/modules/tracks/composables/useAttachTrackLyrics", async () => {
  const { ref } = await import("vue");
  return { useAttachTrackLyrics: () => ({ attachTrackLyrics: attach.attachTrackLyrics, isAttachingLyrics: ref(false) }) };
});
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("@/app/error-feedback", () => feedback);
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

import { useLyricsActions } from "../useLyricsActions";

type LyricsFields = { lyricsPath: string; lyricsFileName: string | null; lyricsOffsetMs?: number };

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

const withLyrics = () => libraryTrack({ lyricsPath: "lyrics/track-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 1200 });

const row = (lyricsPath?: string) => ({ id: "track-1", lyricsPath }) as TrackEntity;

const setup = () => {
  const queryClient = new QueryClient();
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient });
  let api!: ReturnType<typeof useLyricsActions>;
  app.runWithContext(() => {
    effectScope().run(() => {
      api = useLyricsActions();
    });
  });
  return { ...api, queryClient };
};

const lastToast = () => {
  const toasts = shownToasts();
  return toasts[toasts.length - 1];
};

describe("useLyricsActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    player.currentTrack = null;
    storage.saveFile.mockImplementation((path: string) => okAsync(path));
    lyrics.reload.mockResolvedValue(undefined);
    queries.attachTrackLyricsAndSync.mockImplementation(async (_client: unknown, track: Track, fields: LyricsFields) => ({
      ...track,
      lyricsPath: fields.lyricsPath,
      lyricsFileName: fields.lyricsFileName ?? undefined,
      lyricsOffsetMs: fields.lyricsOffsetMs ?? track.lyricsOffsetMs,
    }));
    queries.detachTrackLyricsAndSync.mockImplementation(async (_client: unknown, track: Track) => ({
      ...track,
      lyricsPath: undefined,
      lyricsFileName: undefined,
      lyricsOffsetMs: 0,
    }));
    queries.setTrackLyricsOffsetAndSync.mockImplementation(async (_client: unknown, track: Track, offsetMs: number) => ({
      ...track,
      lyricsOffsetMs: offsetMs,
    }));
    queries.getTrackEntityById.mockResolvedValue(row());
    files.deleteOwnedLyricsFile.mockResolvedValue(undefined);
  });

  it("saves written text as the track's lyrics file and reloads the playing track", async () => {
    const track = libraryTrack({ lyricsOffsetMs: 700 });
    player.currentTrack = track;
    const { saveText, queryClient } = setup();

    const saved = await saveText(track, "First line\nSecond line", { resetOffset: true });

    expect(storage.saveFile).toHaveBeenCalledWith("lyrics/track-1.lrc", expect.any(Blob));
    const blob = storage.saveFile.mock.calls[0][1] as Blob;
    expect(blob.type).toBe("text/plain");
    expect(await blob.text()).toBe("First line\nSecond line");
    expect(queries.attachTrackLyricsAndSync).toHaveBeenCalledWith(queryClient, track, {
      lyricsPath: "lyrics/track-1.lrc",
      lyricsFileName: null,
      lyricsOffsetMs: 0,
    });
    expect(saved).toMatchObject({ lyricsPath: "lyrics/track-1.lrc", lyricsOffsetMs: 0 });
    expect(queue.syncTrackMetadata).toHaveBeenCalledWith(saved);
    expect(lyrics.reload).toHaveBeenCalledTimes(1);
    expect(shownToasts("success").map(toast => toast.title)).toEqual(["lyrics.saved"]);

    player.currentTrack = libraryTrack({ id: "track-2" as Track["id"] });
    await saveText(track, "Edited");

    expect(queries.attachTrackLyricsAndSync.mock.lastCall?.[2]).toMatchObject({ lyricsPath: "lyrics/track-1.lrc", lyricsFileName: null });
    expect(queries.attachTrackLyricsAndSync.mock.lastCall?.[2].lyricsOffsetMs).toBeUndefined();
    expect(lyrics.reload).toHaveBeenCalledTimes(1);
  });

  it("reports a failed save and rethrows so the editor stays open", async () => {
    const track = libraryTrack();
    const failure = new Error("disk full");
    storage.saveFile.mockReturnValueOnce(errAsync(failure));
    const { saveText } = setup();

    await expect(saveText(track, "Words")).rejects.toBe(failure);

    expect(feedback.reportError).toHaveBeenCalledWith(failure, { title: "lyrics.saveFailed", scope: "Lyrics" });
    expect(queries.attachTrackLyricsAndSync).not.toHaveBeenCalled();
    expect(shownToasts("success")).toHaveLength(0);
  });

  it("deletes lyrics at once and offers Undo that restores path, name and offset", async () => {
    const track = withLyrics();
    player.currentTrack = track;
    const { deleteLyrics, queryClient } = setup();

    await deleteLyrics(track);

    expect(queries.detachTrackLyricsAndSync).toHaveBeenCalledWith(queryClient, track);
    expect(queue.syncTrackMetadata).toHaveBeenLastCalledWith(expect.objectContaining({ id: "track-1", lyricsPath: undefined }));
    expect(lyrics.reload).toHaveBeenCalledTimes(1);

    const toast = lastToast();
    expect(toast).toMatchObject({ title: "lyrics.deleted", color: "success" });
    expect(toast.actions?.map(action => action.label)).toEqual(["common.undo"]);

    toast.actions?.[0].onClick?.(new MouseEvent("click"));
    toast.onClose?.();
    await flushPromises();

    expect(queries.attachTrackLyricsAndSync).toHaveBeenCalledWith(queryClient, expect.objectContaining({ id: "track-1" }), {
      lyricsPath: "lyrics/track-1.lrc",
      lyricsFileName: "Song.lrc",
      lyricsOffsetMs: 1200,
    });
    expect(queue.syncTrackMetadata).toHaveBeenLastCalledWith(expect.objectContaining({
      lyricsPath: "lyrics/track-1.lrc",
      lyricsFileName: "Song.lrc",
      lyricsOffsetMs: 1200,
    }));
    expect(lyrics.reload).toHaveBeenCalledTimes(2);
    expect(files.deleteOwnedLyricsFile).not.toHaveBeenCalled();

    await deleteLyrics(track);

    const ids = shownToasts().map(shown => shown.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("removes the stored file when the toast closes without Undo", async () => {
    const track = withLyrics();
    const { deleteLyrics } = setup();

    await deleteLyrics(track);
    expect(files.deleteOwnedLyricsFile).not.toHaveBeenCalled();

    lastToast().onClose?.();
    await flushPromises();

    expect(queries.getTrackEntityById).toHaveBeenCalledWith("track-1");
    expect(files.deleteOwnedLyricsFile).toHaveBeenCalledWith("lyrics/track-1.lrc");
    expect(queries.attachTrackLyricsAndSync).not.toHaveBeenCalled();
  });

  it("keeps the file when the track got lyrics at the same path while the toast was open", async () => {
    const track = withLyrics();
    const { deleteLyrics } = setup();

    await deleteLyrics(track);
    queries.getTrackEntityById.mockResolvedValueOnce(row("lyrics/track-1.lrc"));
    lastToast().onClose?.();
    await flushPromises();

    expect(queries.getTrackEntityById).toHaveBeenCalledWith("track-1");
    expect(files.deleteOwnedLyricsFile).not.toHaveBeenCalled();
  });

  it("saves the lyrics offset and patches the queue", async () => {
    const track = withLyrics();
    const { setOffset, queryClient } = setup();

    const next = await setOffset(track, 800);

    expect(queries.setTrackLyricsOffsetAndSync).toHaveBeenCalledWith(queryClient, track, 800);
    expect(next).toMatchObject({ id: "track-1", lyricsOffsetMs: 800 });
    expect(queue.syncTrackMetadata).toHaveBeenCalledWith(next);
  });
});
