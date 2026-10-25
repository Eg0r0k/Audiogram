import { storeToRefs } from "pinia";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, stat } from "@tauri-apps/plugin-fs";
import { useQueryClient } from "@tanstack/vue-query";
import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";

import { useWatchedFoldersStore } from "../store/watched-folders.store";
import { startWatching } from "../service/folder-watcher";
import {
  countFolderTracks,
  deleteFolderTracks,
  getFolderTracks,
  relinkFolderTracks,
} from "../service/folder-tracks.service";
import type { WatchedFolder } from "../types";
import { musicLibraryEngine } from "@/services/importer.service";
import { getLogger } from "@/lib/logger";
import { normalizePath } from "@/lib/files/filterFiles";
import { IS_MOBILE } from "@/lib/environment/userAgent";
import {
  isAndroidFolderPickerAvailable,
  pickAndroidFolderTreeUri,
  treeUriToPath,
} from "@/lib/android/folderPicker";
import { invalidateLibraryData } from "@/queries/library.queries";
import { formatError } from "@/lib/errors";

const activeWatchers = new Map<string, VoidFunction>();

/** Fallback when the SAF picker bridge is unavailable (outdated APK, web
 *  preview): the public Music directory, readable via direct paths. */
const ANDROID_MUSIC_DIR = "/storage/emulated/0/Music";

/**
 * The watchers are app-wide: App owns them (init, stopAllWatchers), any other
 * caller only borrows the actions and must not tear them down on unmount.
 */
export function useWatchedFolders() {
  const store = useWatchedFoldersStore();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { folders, autoScanOnStartup } = storeToRefs(store);

  // SAF tree picker → real path on the primary volume. The pipeline stays
  // path-based (READ_MEDIA_AUDIO grants direct-path reads of audio under any
  // public folder); SD-card/USB volumes have no path mapping and are
  // turned away with the reason. Cancel → null, silent.
  async function pickMobileFolderPath(): Promise<{ path: string } | { failed: string } | null> {
    if (!isAndroidFolderPickerAvailable()) return { path: ANDROID_MUSIC_DIR };

    const uri = await pickAndroidFolderTreeUri();
    if (!uri) return null;

    const path = treeUriToPath(uri);
    return path ? { path } : { failed: t("watchedFolders.unsupportedVolume") };
  }

  const pickFolderPath = async (): Promise<{ path: string } | { failed: string } | null> => {
    if (IS_MOBILE) return pickMobileFolderPath();
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("watchedFolders.selectFolder"),
    });
    return typeof selected === "string" ? { path: selected } : null;
  };

  async function addPickedFolder(): Promise<string | null> {
    const picked = await pickFolderPath();
    if (!picked) return null;
    if ("failed" in picked) return picked.failed;

    const result = store.addFolder(picked.path);
    if (!result.ok) return t("watchedFolders.alreadyAdded");

    const folder = store.folders[store.folders.length - 1];
    toaster.add({ title: t("watchedFolders.folderAdded", { name: folder.name }), color: "success" });

    await restartAffectedWatchers(folder.path);

    await scanFolder(folder);
    await startFolderWatcher(folder);
    return null;
  }

  /** Resolves to the reason the folder was not added (for the caller to show), or null; never rejects. */
  const addFolder = async (): Promise<string | null> => {
    try {
      return await addPickedFolder();
    }
    catch (error) {
      getLogger().error(`[WatchedFolders] Adding a folder failed: ${formatError(error)}`);
      return t("watchedFolders.addFailed");
    }
  };

  function handleFolderMissing(folderId: string) {
    stopFolderWatcher(folderId);
    store.updateFolderStatus(folderId, "missing", {
      errorMessage: t("watchedFolders.folderMissing"),
    });
  }
  async function removeFolder(id: string) {
    const folder = store.getFolder(id);
    if (!folder) return;

    stopFolderWatcher(id);

    const nestedPaths = store.getNestedFolderPaths(folder.path);

    await deleteFolderTracks(await getFolderTracks(folder.path, nestedPaths));

    const removedPath = folder.path;
    store.removeFolder(id);

    await restartAffectedWatchers(removedPath);

    invalidateLibrary();
  }

  async function scanFolder(folder: WatchedFolder) {
    store.updateFolderStatus(folder.id, "scanning");

    try {
      const folderExists = await exists(folder.path);
      if (!folderExists) {
        store.updateFolderStatus(folder.id, "missing", {
          errorMessage: t("watchedFolders.folderMissing"),
        });
        return;
      }

      const excludedPaths = store.getNestedFolderPaths(folder.path);
      const result = await musicLibraryEngine.syncFolder(folder, undefined, excludedPaths);

      const currentCount = await countFolderTracks(normalizePath(folder.path));

      store.updateFolderStatus(folder.id, "idle", {
        fileCount: currentCount,
        lastScanAt: Date.now(),
      });

      if (result.added > 0 || result.removed > 0) {
        invalidateLibrary();
      }

      if (result.added > 0 || result.removed > 0) {
        toaster.add({ title: t("watchedFolders.scanComplete", {
          added: result.added,
          removed: result.removed,
        }), color: "success" });
      }
    }
    catch (e) {
      getLogger().error(`[WatchedFolders] Scanning ${folder.path} failed: ${formatError(e)}`);
      store.updateFolderStatus(folder.id, "error", { errorMessage: t("watchedFolders.scanFailed") });
    }
  }

  async function scanAllFolders() {
    for (const folder of store.folders) {
      await scanFolder(folder);
    }
  }

  async function startFolderWatcher(folder: WatchedFolder) {
    if (activeWatchers.has(folder.id)) return;

    // Android storage emits no usable FS events (inotify is dead on FUSE);
    // the launch rescan and manual rescans keep the folder in sync instead.
    if (IS_MOBILE) {
      store.updateFolderStatus(folder.id, "watching");
      return;
    }

    try {
      const excludedPaths = store.getNestedFolderPaths(folder.path);

      const handleChangedPaths = async (changedPaths: string[]) => {
        let added = 0;
        let removed = 0;

        for (const path of changedPaths) {
          try {
            const fileExists = await exists(path);
            if (fileExists) {
              const fileStat = await stat(path);
              const ext = path.split(".").pop()?.toLowerCase() ?? "";
              const name = path.split("/").pop() ?? "";
              const success = await musicLibraryEngine.importSingleExternalFile({
                absolutePath: path,
                name,
                ext,
                size: fileStat.size,
                modifiedAt: fileStat.mtime?.getTime() ?? Date.now(),
              });
              if (success) added++;
            }
            else {
              const success = await musicLibraryEngine.removeSingleFile(path); // ⬅️ USE
              if (success) removed++;
            }
          }
          catch {
            // ignore errors on single file watch
          }
        }

        if (added > 0 || removed > 0) {
          invalidateLibrary();
          await recountFolderFiles(folder.id);
        }
      };

      const stop = await startWatching(folder.path, (changedPaths) => {
        handleChangedPaths(changedPaths)
          .catch(error => getLogger().error(`[WatchedFolders] Processing changed paths failed: ${formatError(error)}`));
      }, () => handleFolderMissing(folder.id), excludedPaths);

      activeWatchers.set(folder.id, stop);
      store.updateFolderStatus(folder.id, "watching");
    }
    catch (e) {
      getLogger().error(`[WatchedFolders] Watching ${folder.path} failed: ${formatError(e)}`);
      store.updateFolderStatus(folder.id, "error", { errorMessage: t("watchedFolders.watchFailed") });
    }
  }

  async function restartAffectedWatchers(changedPath: string) {
    for (const folder of store.folders) {
      if (folder.path === changedPath) continue;
      if (changedPath.startsWith(folder.path + "/") && activeWatchers.has(folder.id)) {
        stopFolderWatcher(folder.id);
        await startFolderWatcher(folder);
      }
    }
  }

  function stopFolderWatcher(folderId: string) {
    const stop = activeWatchers.get(folderId);
    if (stop) {
      stop();
      activeWatchers.delete(folderId);
    }
    const folder = store.getFolder(folderId);
    if (folder && folder.status === "watching") {
      store.updateFolderStatus(folderId, "idle");
    }
  }

  function stopAllWatchers() {
    for (const [id, stop] of activeWatchers) {
      stop();
      activeWatchers.delete(id);
    }
    for (const folder of store.folders) {
      if (folder.status === "watching") {
        store.updateFolderStatus(folder.id, "idle");
      }
    }
  }

  async function recountFolderFiles(folderId: string) {
    const folder = store.getFolder(folderId);
    if (!folder) return;

    const nestedPaths = store.getNestedFolderPaths(folder.path);

    const count = await countFolderTracks(folder.path, nestedPaths);

    store.updateFolderStatus(folder.id, folder.status, { fileCount: count });
  }

  async function init() {
    if (store.folders.length === 0) return;

    if (autoScanOnStartup.value) {
      await scanAllFolders();
    }

    for (const folder of store.folders) {
      if (folder.status !== "error" && folder.status !== "missing") {
        await startFolderWatcher(folder);
      }
    }
  }

  function invalidateLibrary() {
    invalidateLibraryData(queryClient)
      .catch(error => getLogger().error(`[WatchedFolders] Library refresh failed: ${formatError(error)}`));
  }

  async function relinkFolder(folderId: string) {
    const folder = store.getFolder(folderId);
    if (!folder) return;

    const selected = await open({
      directory: true,
      multiple: false,
      title: t("watchedFolders.selectNewLocation"),
    });

    if (!selected || typeof selected !== "string") return;

    const newPath = normalizePath(selected);
    const oldPath = folder.path;

    store.updateFolderStatus(folderId, "scanning");

    try {
      await relinkFolderTracks(oldPath, newPath);

      store.updateFolderPath(folderId, newPath);

      const updatedFolder = store.getFolder(folderId)!;
      await scanFolder(updatedFolder);
      await startFolderWatcher(updatedFolder);

      toaster.add({ title: t("watchedFolders.folderRelinked", { name: updatedFolder.name }), color: "success" });
      invalidateLibrary();
    }
    catch (e) {
      getLogger().error(`[WatchedFolders] Relinking ${oldPath} to ${newPath} failed: ${formatError(e)}`);
      store.updateFolderStatus(folderId, "error", { errorMessage: t("watchedFolders.relinkFailed") });
    }
  }

  return {
    folders,
    autoScanOnStartup,
    addFolder,
    removeFolder,
    scanFolder,
    scanAllFolders,
    stopAllWatchers,
    relinkFolder,
    init,
  };
}
