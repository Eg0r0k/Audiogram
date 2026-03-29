import { onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, stat } from "@tauri-apps/plugin-fs";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { db } from "@/db";
import { useWatchedFoldersStore } from "../store/watched-folders.store";
import { startWatching, type StopWatchFn } from "../services/folder-watcher";
import type { WatchedFolder } from "../types";
import { musicLibraryEngine } from "@/services/importer.service";

const activeWatchers = new Map<string, StopWatchFn>();

export function useWatchedFolders() {
  const store = useWatchedFoldersStore();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { folders, autoScanOnStartup } = storeToRefs(store);

  async function addFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("watchedFolders.selectFolder"),
    });

    if (!selected || typeof selected !== "string") return;

    const result = store.addFolder(selected);
    if (!result.ok) {
      toast.error(result.error!);
      return;
    }

    const folder = store.folders[store.folders.length - 1];
    toast.success(t("watchedFolders.folderAdded", { name: folder.name }));

    await restartAffectedWatchers(folder.path);

    await scanFolder(folder);
    await startFolderWatcher(folder);
  }

  async function removeFolder(id: string) {
    const folder = store.getFolder(id);
    if (!folder) return;

    stopFolderWatcher(id);

    const nestedPaths = store.getNestedFolderPaths(folder.path);

    const tracksToRemove = await db.tracks
      .where("storagePath")
      .startsWith(folder.path + "/")
      .toArray();

    const filteredTracks = nestedPaths.length > 0
      ? tracksToRemove.filter(
          t => !nestedPaths.some(np => t.storagePath.startsWith(np + "/")),
        )
      : tracksToRemove;

    if (filteredTracks.length > 0) {
      await db.tracks.bulkDelete(filteredTracks.map(t => t.id));
    }

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
        store.updateFolderStatus(folder.id, "error", {
          errorMessage: "Folder not found",
        });
        return;
      }

      const excludedPaths = store.getNestedFolderPaths(folder.path);
      const result = await musicLibraryEngine.syncFolder(folder, undefined, excludedPaths);

      store.updateFolderStatus(folder.id, "idle", {
        fileCount: result.added + (folder.fileCount - result.removed),
        lastScanAt: Date.now(),
      });

      if (result.added > 0 || result.removed > 0) {
        invalidateLibrary();
      }

      if (result.added > 0 || result.removed > 0) {
        toast.success(t("watchedFolders.scanComplete", {
          added: result.added,
          removed: result.removed,
        }));
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : "Scan failed";
      store.updateFolderStatus(folder.id, "error", { errorMessage: message });
    }
  }

  async function scanAllFolders() {
    for (const folder of store.folders) {
      await scanFolder(folder);
    }
  }

  async function startFolderWatcher(folder: WatchedFolder) {
    if (activeWatchers.has(folder.id)) return;

    try {
      const excludedPaths = store.getNestedFolderPaths(folder.path);

      const stop = await startWatching(folder.path, async (changedPaths) => {
        let added = 0;
        let removed = 0;

        for (const path of changedPaths) {
          try {
            const fileExists = await exists(path);
            if (fileExists) {
              const fileStat = await stat(path);
              const ext = path.split(".").pop()?.toLowerCase() ?? "";
              const name = path.split("/").pop() ?? "";
              const success = await musicLibraryEngine.importSingleExternalFile({ // ⬅️ USE
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
          toast.info(`Библиотека обновлена: +${added} / -${removed}`);
          invalidateLibrary();
          await recountFolderFiles(folder.id);
        }
      }, excludedPaths);

      activeWatchers.set(folder.id, stop);
      store.updateFolderStatus(folder.id, "watching");
    }
    catch (e) {
      const message = e instanceof Error ? e.message : "Watch failed";
      store.updateFolderStatus(folder.id, "error", { errorMessage: message });
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

    let count: number;
    if (nestedPaths.length > 0) {
      const allTracks = await db.tracks
        .where("storagePath")
        .startsWith(folder.path + "/")
        .toArray();
      count = allTracks.filter(
        t => !nestedPaths.some(np => t.storagePath.startsWith(np + "/")),
      ).length;
    }
    else {
      count = await db.tracks
        .where("storagePath")
        .startsWith(folder.path + "/")
        .count();
    }

    store.updateFolderStatus(folder.id, folder.status, { fileCount: count });
  }

  async function init() {
    if (store.folders.length === 0) return;

    if (autoScanOnStartup.value) {
      await scanAllFolders();
    }

    for (const folder of store.folders) {
      if (folder.status !== "error") {
        await startFolderWatcher(folder);
      }
    }
  }

  function invalidateLibrary() {
    queryClient.invalidateQueries({ queryKey: ["library"] });
  }

  onUnmounted(() => {
    stopAllWatchers();
  });

  return {
    folders,
    autoScanOnStartup,
    addFolder,
    removeFolder,
    scanFolder,
    scanAllFolders,
    stopAllWatchers,
    init,
  };
}
