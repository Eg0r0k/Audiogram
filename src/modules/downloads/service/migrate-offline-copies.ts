import { db } from "@/db";
import { storageService } from "@/db/storage";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { platformCaps } from "@/lib/environment/platformCaps";
import { getLogger } from "@/lib/logger";
import { rebuildSearchIndex } from "@/modules/search/service/searchIndex";
import { sourceKindOfId } from "@/types/track-ref";
import { importDownloadedFile } from "./finalize";

//
// One-time move from "offline copy of a remote row" to "downloaded local
// track" (spec §5). Runs after the DB is open and the storage service is
// usable — an import cannot happen inside a Dexie upgrade transaction. The
// flag makes the demotion a one-shot: after it, a remote pinned = 1 row is an
// explicit "Add to library" and must stay.
//

export const MIGRATION_FLAG = "audiogram:download-is-import:v1";

const isRemoteId = (id: string): boolean => sourceKindOfId(id) !== "local";

const absolutePathOf = (appDataDir: string, storagePath: string): string =>
  `${appDataDir.replace(/\\/g, "/").replace(/\/$/, "")}/${storagePath}`;

const importCopies = async (): Promise<void> => {
  const copies = await db.offlineCopies.toArray();
  // The narrowing never fails behind the `hasFs` gate; the import needs an
  // absolute path, which only the native adapter can build.
  if (copies.length === 0 || !hasNativeSupport(storageService)) return;
  const appDataDir = await storageService.getAppDataDir();

  for (const copy of copies) {
    const size = await storageService.getFileSize(copy.storagePath);
    if (size.isOk()) {
      try {
        await importDownloadedFile(copy.trackId, absolutePathOf(appDataDir, copy.storagePath));
        await storageService.deleteFile(copy.storagePath);
      }
      catch (error) {
        // The row survives only as a lost file; keep it out of the way and
        // let the user download again.
        getLogger().warn(`[Migration] Importing the offline copy of ${copy.trackId} failed: ${String(error)}`);
      }
    }
    else {
      getLogger().warn(`[Migration] Offline copy file missing for ${copy.trackId}: ${copy.storagePath}`);
    }
    await db.offlineCopies.delete(copy.trackId);
  }
};

const demoteRemoteRows = async (): Promise<void> => {
  await db.transaction("rw", db.tracks, db.albums, db.artists, async () => {
    const pinnedTrackIds = (await db.tracks.where("pinned").equals(1).primaryKeys()).filter(isRemoteId);
    if (pinnedTrackIds.length > 0) {
      await db.tracks.where("id").anyOf(pinnedTrackIds).modify({ pinned: 0 });
    }

    const albums = await db.albums.where("pinned").equals(1).filter(album => isRemoteId(album.id)).toArray();
    for (const album of albums) {
      const left = await db.tracks.where("[albumId+pinned]").equals([album.id, 1]).count();
      if (left === 0) await db.albums.update(album.id, { pinned: 0 });
    }

    const artists = await db.artists.where("pinned").equals(1).filter(artist => isRemoteId(artist.id)).toArray();
    for (const artist of artists) {
      const left = await db.tracks.where("artistIds").equals(artist.id).filter(track => track.pinned === 1).count();
      if (left === 0) await db.artists.update(artist.id, { pinned: 0 });
    }
  });
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

  let done = false;
  try {
    done = localStorage.getItem(MIGRATION_FLAG) === "1";
  }
  catch {
    // Storage unavailable: run again next launch.
  }
  if (done) return;

  await importCopies();
  await demoteRemoteRows();
  await removeOfflineDir();
  await rebuildSearchIndex();

  try {
    localStorage.setItem(MIGRATION_FLAG, "1");
  }
  catch {
    // See above.
  }
  getLogger().info("[Migration] download-is-import: offline copies imported, remote rows demoted");
};
