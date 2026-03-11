import { IS_TAURI } from "@/lib/environment/userAgent";
import type { IFileStorage } from "@/db/storage/IFileStorage";

let instance: IFileStorage | null = null;

export async function getFileStorage(): Promise<IFileStorage> {
  if (instance) return instance;

  if (IS_TAURI) {
    const { TauriStorage } = await import("@/db/storage/tauri.storage");
    instance = new TauriStorage();
  }
  else {
    const { WebOpfsStorage } = await import("@/db/storage/web-opfs.storage");
    instance = new WebOpfsStorage();
  }

  return instance;
}

const coverUrlCache = new Map<string, string>();

export async function resolveCoverUrl(coverPath: string | undefined): Promise<string | undefined> {
  if (!coverPath) return undefined;

  const cached = coverUrlCache.get(coverPath);
  if (cached) return cached;

  try {
    const storage = await getFileStorage();
    const result = await storage.getAudioUrl(coverPath);
    if (result.isOk()) {
      coverUrlCache.set(coverPath, result.value);
      return result.value;
    }
  }
  catch {
    // noop
  }

  return undefined;
}

export async function resolveCoverUrls(
  paths: (string | undefined)[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const toResolve: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    const cached = coverUrlCache.get(p);
    if (cached) {
      resolved.set(p, cached);
    }
    else {
      toResolve.push(p);
    }
  }

  if (toResolve.length === 0) return resolved;

  const storage = await getFileStorage();

  await Promise.all(
    toResolve.map(async (path) => {
      try {
        const result = await storage.getAudioUrl(path);
        if (result.isOk()) {
          coverUrlCache.set(path, result.value);
          resolved.set(path, result.value);
        }
      }
      catch {
        // noop
      }
    }),
  );

  return resolved;
}
