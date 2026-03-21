import { IS_TAURI } from "@/lib/environment/userAgent";
import { TrackSource } from "@/db/entities";
import { storageService } from "@/db/storage";

// ── Cover URL cache ──────────────────────────────────────────────
// coverPath → blob URL
// Глобальный кэш: один blob на путь, переиспользуется всеми компонентами.
// invalidateCover() обязателен перед записью новой обложки — иначе старый blob утечёт.

const cache = new Map<string, string>();

export async function getCoverUrl(coverPath: string | undefined): Promise<string | undefined> {
  if (!coverPath) return undefined;

  const cached = cache.get(coverPath);
  if (cached) return cached;

  const result = await storageService.getFile(coverPath);
  if (result.isErr()) return undefined;

  const url = URL.createObjectURL(result.value);
  cache.set(coverPath, url);
  return url;
}

export function invalidateCover(coverPath: string): void {
  const url = cache.get(coverPath);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(coverPath);
  }
}

export function invalidateAllCovers(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }
  cache.clear();
}

// ── Track source resolution ──────────────────────────────────────
// Не возвращает blob URL — только для Tauri (convertFileSrc).
// В вебе треки резолвятся через resolveTrackBlob() напрямую в Blob.

export async function resolveTrackUrl(
  source: TrackSource,
  storagePath: string,
): Promise<string | null> {
  if (source === TrackSource.LOCAL_EXTERNAL && !IS_TAURI) {
    return null;
  }
  const result = await storageService.getAudioUrl(storagePath);
  return result.isOk() ? result.value : null;
}
