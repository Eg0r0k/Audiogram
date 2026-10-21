import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { PlaylistId } from "@/types/ids";
import { shownToasts } from "@/test/toasts";

const playlistQueries = vi.hoisted(() => ({
  addTrackToPlaylistAndSync: vi.fn(),
  removeTrackFromPlaylistWithUndo: vi.fn(),
}));
const stats = vi.hoisted(() => ({ removeFromHistory: vi.fn() }));
const pinning = vi.hoisted(() => ({ ensurePinned: vi.fn() }));
const likes = vi.hoisted(() => ({ toggleTrackLike: vi.fn() }));
const lyrics = vi.hoisted(() => ({ attachTrackLyrics: vi.fn() }));
const downloads = vi.hoisted(() => ({ downloadSubject: vi.fn() }));
const storage = vi.hoisted(() => ({ getFile: vi.fn() }));

vi.mock("@/queries/playlist.queries", () => playlistQueries);
vi.mock("@/services/stats.service", () => ({ statsService: stats }));
vi.mock("@/modules/tracks/service/ensurePinned", () => pinning);
vi.mock("../useToggleTrackLike", () => ({ useToggleTrackLike: () => likes }));
vi.mock("../useAttachTrackLyrics", () => ({ useAttachTrackLyrics: () => lyrics }));
vi.mock("@/modules/downloads/service/enqueue", () => downloads);
vi.mock("@/modules/downloads/service/manager", () => ({ cancelTrackDownload: vi.fn() }));
vi.mock("@/modules/downloads/service/removeCopy", () => ({ removeLocalCopy: vi.fn() }));
vi.mock("@/modules/downloads/store/downloads.store", () => ({ useDownloadsStore: () => ({ byTrackId: {} }) }));
vi.mock("@/modules/tracks/service/libraryMembership", () => ({ promoteTrackToLibrary: vi.fn(), removeTrackFromLibrary: vi.fn() }));
vi.mock("@/queries/library.queries", () => ({ invalidateLibraryData: vi.fn(async () => {}) }));
vi.mock("@/queries/localCopy.queries", () => ({ getLocalCopy: vi.fn(async () => null) }));
vi.mock("@/db/storage", () => ({ storageService: storage }));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasFs: false } }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/modules/sources", () => ({ sources: { find: vi.fn() } }));
vi.mock("@/modules/queue/store/queue.store", () => ({ useQueueStore: () => ({ queue: [] }) }));
vi.mock("@/modules/right-panel/store/right-panel.store", () => ({ useRightPanelStore: () => ({}) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ fullPath: "/" }) }));
vi.mock("@tanstack/vue-query", () => ({ useQueryClient: () => ({ tag: "qc" }) }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/app/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));

import { useTrackContextActions } from "../useTrackContextActions";

const PLAYLIST = "pl-1" as PlaylistId;

const libraryTrack = (): Track => ({
  kind: "library",
  id: "t1" as Track["id"],
  title: "One",
  artist: "Artist",
  artistIds: [],
  albumId: "" as Track["albumId"],
  albumName: "",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
});

const remoteSubject = { kind: "remote" as const, dto: { id: "ym:1", title: "Remote" } };

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const undoOf = (title: string) => {
  const toast = shownToasts("success").find(shown => shown.title === title);
  expect(toast?.actions?.[0]?.label).toBe("common.undo");
  return () => toast?.actions?.[0]?.onClick?.(new MouseEvent("click"));
};

describe("useTrackContextActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes a track from a playlist with an undo that puts it back", async () => {
    const restore = vi.fn(async () => {});
    playlistQueries.removeTrackFromPlaylistWithUndo.mockResolvedValue({ restore });
    const actions = useTrackContextActions(libraryTrack(), { playlistId: PLAYLIST });

    actions.removeFromPlaylist?.();
    await flush();
    undoOf("playlist.trackRemoved")();
    await flush();

    expect(playlistQueries.removeTrackFromPlaylistWithUndo).toHaveBeenCalledWith({ tag: "qc" }, PLAYLIST, "t1");
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("removes a track from the history with an undo that brings its listens back", async () => {
    const restore = vi.fn(async () => {});
    stats.removeFromHistory.mockResolvedValue(restore);
    const actions = useTrackContextActions(libraryTrack());

    actions.removeFromHistory?.();
    await flush();
    undoOf("track.removedFromHistory")();
    await flush();

    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("names the action that failed when a catalog track could not get its row", async () => {
    pinning.ensurePinned.mockRejectedValue(new Error("quota"));
    const actions = useTrackContextActions(null, { subject: remoteSubject as never });

    actions.addToPlaylist?.(PLAYLIST);
    actions.toggleLike?.();
    actions.attachLyrics?.();
    await flush();

    expect(shownToasts("destructive").map(toast => toast.title)).toEqual([
      "playlist.addTrackFailed",
      "track.likeToggleFailed",
      "player.lyricsAttachFailed",
    ]);
  });

  it("calls a saved copy a saved file, not a download", async () => {
    storage.getFile.mockReturnValue({ isErr: () => false, value: new Blob(["x"]) });
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const actions = useTrackContextActions(libraryTrack());

    actions.exportFile?.();
    await flush();

    expect(shownToasts("success")).toContainEqual(expect.objectContaining({ title: "track.exported" }));
  });

  it("calls a failed save a failed save, not a failed download", async () => {
    storage.getFile.mockReturnValue({ isErr: () => true, error: new Error("gone") });
    const actions = useTrackContextActions(libraryTrack());

    actions.exportFile?.();
    await flush();

    expect(shownToasts("destructive")).toContainEqual(expect.objectContaining({ title: "track.exportFailed" }));
  });

  it("reports an offline download that could not start as such", async () => {
    downloads.downloadSubject.mockRejectedValue(new Error("db"));
    const actions = useTrackContextActions(libraryTrack());

    actions.downloadOffline?.();
    await flush();

    expect(shownToasts("destructive")).toContainEqual(expect.objectContaining({ title: "downloads.enqueueFailed" }));
  });

  // A playing stream has no library row, but its proxied URL names the
  // catalog track it came from, and that is what the download pins.
  const streamSubject = (sourceDto?: { id: string; title: string; artistIds?: string[] }) => ({
    kind: "ephemeral" as const,
    track: {
      kind: "ephemeral" as const,
      id: "e1",
      title: "Stream",
      artist: "Someone",
      source: { type: "url" as const, url: "http://127.0.0.1:4321/tok/yt/abc" },
      ...(sourceDto ? { sourceDto } : {}),
    },
  });

  it("downloads a playing YouTube stream under its stream identity", async () => {
    downloads.downloadSubject.mockResolvedValue("job-1");
    const subject = streamSubject();
    const actions = useTrackContextActions(subject.track, { subject: subject as never });

    actions.downloadOffline?.();
    await flush();

    expect(downloads.downloadSubject).toHaveBeenCalledWith({
      kind: "remote",
      dto: expect.objectContaining({ id: "yt:abc", title: "Stream", artistName: "Someone" }),
    });
  });

  it("downloads a stream that carries its catalog DTO as that DTO", async () => {
    downloads.downloadSubject.mockResolvedValue("job-1");
    const dto = { id: "yt:abc", title: "Catalog", artistIds: ["yt:artist"] };
    const subject = streamSubject(dto);
    const actions = useTrackContextActions(subject.track, { subject: subject as never });

    actions.downloadOffline?.();
    await flush();

    expect(downloads.downloadSubject).toHaveBeenCalledWith({ kind: "remote", dto });
  });
});
