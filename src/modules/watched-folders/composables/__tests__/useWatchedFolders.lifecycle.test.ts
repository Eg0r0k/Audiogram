import { describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { mount } from "@vue/test-utils";
import type { WatchedFolder } from "../../types";

const stopWatcher = vi.hoisted(() => vi.fn());

const storeMock = vi.hoisted(() => ({
  folders: [{ id: "f1", path: "/music", name: "music", status: "idle" }] as WatchedFolder[],
  updateFolderStatus: vi.fn(),
  getNestedFolderPaths: vi.fn(() => []),
  getFolder: vi.fn(),
}));

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: vi.fn(async () => true), stat: vi.fn() }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@tanstack/vue-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/queries/library.queries", () => ({ invalidateLibraryData: vi.fn() }));
vi.mock("@/services/importer.service", () => ({ musicLibraryEngine: {} }));
vi.mock("@/services/library-gc", () => ({ cleanupAfterTrackRemoval: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/unit-of-work", () => ({ unitOfWork: {} }));
vi.mock("@/modules/watched-folders/services/folder-watcher", () => ({
  startWatching: vi.fn(async () => stopWatcher),
}));
vi.mock("@/modules/watched-folders/store/watched-folders.store", () => ({
  useWatchedFoldersStore: () => storeMock,
}));
vi.mock("pinia", () => ({
  storeToRefs: () => ({ folders: ref(storeMock.folders), autoScanOnStartup: ref(false) }),
}));

import { useWatchedFolders } from "../useWatchedFolders";

describe("useWatchedFolders lifecycle", () => {
  it("keeps the folder watchers running when a component that borrowed the composable unmounts", async () => {
    let init: () => Promise<void> = async () => {};
    mount(defineComponent({
      setup: () => {
        ({ init } = useWatchedFolders());
        return () => null;
      },
    }));
    await init();

    const page = mount(defineComponent({
      setup: () => {
        useWatchedFolders();
        return () => null;
      },
    }));
    page.unmount();

    expect(stopWatcher).not.toHaveBeenCalled();
  });
});
