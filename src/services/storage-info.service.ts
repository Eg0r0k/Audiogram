import { db } from "@/db";
import { storageService } from "@/db/storage";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { IS_TAURI } from "@/lib/environment/userAgent";
import { StorageInfo } from "@/modules/settings/schema/storage";

async function calculateFolderSize(folder: string): Promise<number> {
  const result = await storageService.listFiles(folder);

  if (result.isErr()) return 0;

  const files = result.value;
  let totalSize = 0;

  for (const filePath of files) {
    const fileResult = await storageService.getFile(filePath);
    if (fileResult.isOk()) {
      totalSize += fileResult.value.size;
    }
  }

  return totalSize;
}

async function getQuotaInfo(): Promise<{ total: number; used: number }> {
  if (!IS_TAURI && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      total: estimate.quota ?? 0,
      used: estimate.usage ?? 0,
    };
  }

  return { total: 0, used: 0 };
}

async function getStoragePath(): Promise<string> {
  if (hasNativeSupport(storageService)) {
    return storageService.getAppDataDir();
  }
  return "Browser OPFS";
}

async function getDbSize(): Promise<number> {
  if (!IS_TAURI) {
    try {
      const tracks = await db.tracks.count();
      const artists = await db.artists.count();
      const albums = await db.albums.count();
      const tags = await db.tags.count();
      return (tracks + artists + albums + tags) * 500;
    }
    catch {
      return 0;
    }
  }
  return 0;
}

export async function collectStorageInfo(): Promise<StorageInfo> {
  const [
    tracksSize,
    coversSize,
    dbSize,
    quota,
    storagePath,
    tracksCount,
    albumsCount,
    artistsCount,
  ] = await Promise.all([
    calculateFolderSize("tracks"),
    calculateFolderSize("covers"),
    getDbSize(),
    getQuotaInfo(),
    getStoragePath(),
    db.tracks.count(),
    db.albums.count(),
    db.artists.count(),
  ]);

  return {
    tracksSize,
    coversSize,
    dbSize,
    quotaTotal: quota.total,
    quotaUsed: quota.used,
    tracksCount,
    albumsCount,
    artistsCount,
    storagePath,
  };
}

export async function clearCovers(): Promise<void> {
  const result = await storageService.listFiles("covers");
  if (result.isErr()) return;

  for (const filePath of result.value) {
    await storageService.deleteFile(filePath);
  }

  await db.albums.toCollection().modify({ coverPath: undefined });
}

export async function clearAllData(): Promise<void> {
  const folders = ["tracks", "covers"];
  for (const folder of folders) {
    const result = await storageService.listFiles(folder);
    if (result.isOk()) {
      for (const filePath of result.value) {
        await storageService.deleteFile(filePath);
      }
    }
  }

  await db.tracks.clear();
  await db.albums.clear();
  await db.artists.clear();
  await db.tags.clear();
}
