import { db } from "@/db";
import { storageService } from "@/db/storage";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { platformCaps } from "@/lib/environment/platformCaps";
import { getLogger } from "@/lib/logger";
import { importDownloadedFile } from "./finalize";

//
// Post-open half of the v16 upgrade (spec §5): the files behind the legacy
// `offlineCopies` rows become local tracks through the regular import — file
// IO cannot run inside Dexie's upgrade transaction, which is where the row
// demotion lives (upgradeToV16). No flag: the table IS the state. Every row
// is deleted once handled, so a finished migration is an empty table and the
// next launch does nothing.
//

const absolutePathOf = (appDataDir: string, storagePath: string): string =>
  `${appDataDir.replace(/\\/g, "/").replace(/\/$/, "")}/${storagePath}`;

/**
 * Drains `offlineCopies`. Returns false when at least one import threw: that
 * file was never imported anywhere, so it is still the only copy and the
 * folder must survive.
 */
const importCopies = async (): Promise<boolean> => {
  const copies = await db.offlineCopies.toArray();
  if (copies.length === 0) return true;
  // The narrowing never fails behind the `hasFs` gate; the import needs an
  // absolute path, which only the native adapter can build.
  if (!hasNativeSupport(storageService)) return false;
  const appDataDir = await storageService.getAppDataDir();

  let allHandled = true;
  for (const copy of copies) {
    const size = await storageService.getFileSize(copy.storagePath);
    if (size.isOk()) {
      try {
        await importDownloadedFile(copy.trackId, absolutePathOf(appDataDir, copy.storagePath));
        await storageService.deleteFile(copy.storagePath);
      }
      catch (error) {
        allHandled = false;
        getLogger().warn(`[Migration] Importing the offline copy of ${copy.trackId} failed: ${String(error)}`);
      }
    }
    else {
      getLogger().warn(`[Migration] Offline copy file missing for ${copy.trackId}: ${copy.storagePath}`);
    }
    await db.offlineCopies.delete(copy.trackId);
  }
  return allHandled;
};

const removeOfflineDir = async (): Promise<void> => {
  try {
    const { BaseDirectory, remove } = await import("@tauri-apps/plugin-fs");
    await remove("offline", { baseDir: BaseDirectory.AppData, recursive: true });
  }
  catch {
    // Best-effort: leftovers are dead weight, not a correctness problem.
  }
};

export const migrateOfflineCopies = async (): Promise<void> => {
  if (!platformCaps.hasFs) return;
  if ((await db.offlineCopies.count()) === 0) return;

  const allHandled = await importCopies();
  if (allHandled) await removeOfflineDir();
  else getLogger().warn("[Migration] An offline copy could not be imported: offline/ and its files are kept");
  getLogger().info("[Migration] download-is-import: offline copies imported as local tracks");
};
