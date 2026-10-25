import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { WatchedFolder } from "../../types";
import { shownToasts } from "@/test/toasts";

const storeMock = vi.hoisted(() => ({
  folders: [] as WatchedFolder[],
  addFolder: vi.fn(),
  updateFolderStatus: vi.fn(),
  updateFolderPath: vi.fn(),
  getNestedFolderPaths: vi.fn(() => []),
  getFolder: vi.fn(),
}));
const fsMock = vi.hoisted(() => ({ exists: vi.fn(async () => true) }));
const dialogMock = vi.hoisted(() => ({ open: vi.fn() }));
const engineMock = vi.hoisted(() => ({ syncFolder: vi.fn(async () => ({ added: 0, removed: 0 })) }));
const folderTracks = vi.hoisted(() => ({
  countFolderTracks: vi.fn(async () => 0),
  deleteFolderTracks: vi.fn(),
  getFolderTracks: vi.fn(),
  relinkFolderTracks: vi.fn(),
}));

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: true }));
vi.mock("@tauri-apps/plugin-dialog", () => dialogMock);
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: fsMock.exists, stat: vi.fn() }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@tanstack/vue-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/queries/library.queries", () => ({ invalidateLibraryData: vi.fn(async () => {}) }));
vi.mock("@/services/importer.service", () => ({ musicLibraryEngine: engineMock }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) }));
vi.mock("../../service/folder-tracks.service", () => folderTracks);
const watcherMock = vi.hoisted(() => ({ startWatching: vi.fn(async () => () => {}) }));
vi.mock("../../service/folder-watcher", () => watcherMock);
vi.mock("../../store/watched-folders.store", () => ({ useWatchedFoldersStore: () => storeMock }));
vi.mock("pinia", () => ({
  storeToRefs: () => ({ folders: ref([]), autoScanOnStartup: ref(false) }),
}));

import { useWatchedFolders } from "../useWatchedFolders";

const folder: WatchedFolder = {
  id: "f1",
  path: "D:/Music",
  name: "Music",
  addedAt: 0,
  lastScanAt: null,
  fileCount: 0,
  status: "watching",
};

const lastStatus = () => storeMock.updateFolderStatus.mock.calls.at(-1);

describe("useWatchedFolders messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.folders.length = 0;
    fsMock.exists.mockResolvedValue(true);
    storeMock.getFolder.mockReturnValue(folder);
  });

  it("hands back why an already watched folder was not added, for the caller to show", async () => {
    dialogMock.open.mockResolvedValueOnce("D:/Music");
    storeMock.addFolder.mockReturnValueOnce({ ok: false, error: "already-added" });

    await expect(useWatchedFolders().addFolder()).resolves.toBe("watchedFolders.alreadyAdded");
    expect(shownToasts("destructive")).toHaveLength(0);
  });

  it("hands back a failure instead of rejecting into nothing", async () => {
    dialogMock.open.mockRejectedValueOnce(new Error("dialog crashed"));

    await expect(useWatchedFolders().addFolder()).resolves.toBe("watchedFolders.addFailed");
  });

  it("names a vanished folder in the app language", async () => {
    fsMock.exists.mockResolvedValueOnce(false);

    await useWatchedFolders().scanFolder(folder);

    expect(lastStatus()).toEqual(["f1", "missing", { errorMessage: "watchedFolders.folderMissing" }]);
  });

  it("shows a failed scan in the app language instead of the raw error", async () => {
    engineMock.syncFolder.mockRejectedValueOnce(new Error("EACCES: permission denied, scandir"));

    await useWatchedFolders().scanFolder(folder);

    expect(lastStatus()).toEqual(["f1", "error", { errorMessage: "watchedFolders.scanFailed" }]);
  });

  it("shows a watcher that could not start in the app language", async () => {
    dialogMock.open.mockResolvedValueOnce("D:/Music");
    storeMock.addFolder.mockImplementationOnce(() => {
      storeMock.folders.push(folder);
      return { ok: true };
    });
    watcherMock.startWatching.mockRejectedValueOnce(new Error("notify: too many watches"));

    await useWatchedFolders().addFolder();

    expect(lastStatus()).toEqual(["f1", "error", { errorMessage: "watchedFolders.watchFailed" }]);
  });

  it("shows a failed relink in the folder row only", async () => {
    dialogMock.open.mockResolvedValueOnce("E:/Music");
    folderTracks.relinkFolderTracks.mockRejectedValueOnce(new Error("ConstraintError"));

    await useWatchedFolders().relinkFolder("f1");

    expect(lastStatus()).toEqual(["f1", "error", { errorMessage: "watchedFolders.relinkFailed" }]);
    expect(shownToasts("destructive")).toHaveLength(0);
  });
});
