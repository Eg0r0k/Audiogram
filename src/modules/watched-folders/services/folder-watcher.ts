import { watch as fsWatch, exists } from "@tauri-apps/plugin-fs";
import { useDebounceFn } from "@vueuse/core";
import { isValidImportItem } from "@/lib/environment/mimeSupport";
import { normalizePath } from "@/lib/files/filterFiles";
import { getLogger } from "@/lib/logger";

export type FileChangeHandler = (paths: string[]) => void;
export type FolderMissingHandler = () => void;
export type StopWatchFn = () => void;

const FLUSH_DEBOUNCE_MS = 1500;
/**
 * Ceiling on how long a path may sit unreported while events keep arriving.
 * The native watcher batches at `delayMs` 1000 — always shorter than the
 * debounce — so copying a large library would re-arm the trailing flush for the
 * whole copy and nothing would be imported until it stopped.
 */
const MAX_FLUSH_DELAY_MS = 5000;

export async function startWatching(
  folderPath: string,
  onChange: FileChangeHandler,
  onFolderMissing: FolderMissingHandler,
  excludedPaths?: string[],
): Promise<StopWatchFn> {
  // Every changed file arrives as its own watcher event, while useDebounceFn
  // keeps the arguments of the LAST call only — so the window's paths pile up
  // here and the flush drains them.
  const pending = new Set<string>();
  // Stored folder paths may carry Windows separators, while the paths they are
  // compared against are normalized. folder-sync normalizes its own copy for
  // the same reason.
  const excluded = (excludedPaths ?? []).map(normalizePath);

  let stopped = false;
  let oldestPendingAt = 0;
  // Read through a call, not directly: the flag flips in the cleanup closure
  // below, and type-aware lint (no-unnecessary-condition) narrows a plain
  // `stopped` to `false` and rejects every later check as dead.
  const isStopped = () => stopped;

  const runFlush = async () => {
    if (isStopped() || pending.size === 0) return;

    const changedPaths = [...pending];
    pending.clear();
    oldestPendingAt = 0;

    try {
      const folderExists = await exists(folderPath);
      if (!folderExists) {
        if (!isStopped()) onFolderMissing();
        return;
      }

      const audioPaths = changedPaths
        .map(normalizePath)
        .filter((p) => {
          if (!isValidImportItem(p.split("/").pop() ?? "")) return false;
          return !excluded.some(dir => p.startsWith(dir + "/"));
        });

      if (audioPaths.length > 0 && !isStopped()) {
        onChange(audioPaths);
      }
    }
    catch (error) {
      // The batch is forgotten only once it has been handed over. A flush that
      // fails half way — a plugin-fs hiccup, a drive going away — would
      // otherwise hide those files until the next full scan, so they go back
      // and ride the next event's window.
      for (const path of changedPaths) pending.add(path);
      oldestPendingAt = Date.now();
      throw error;
    }
  };

  const flush = useDebounceFn(runFlush, FLUSH_DEBOUNCE_MS);

  let unwatch: (() => void) | null = null;

  try {
    unwatch = await fsWatch(
      folderPath,
      (event) => {
        if (event.paths.length === 0) return;
        if (pending.size === 0) oldestPendingAt = Date.now();
        for (const path of event.paths) pending.add(path);

        const overdue = Date.now() - oldestPendingAt >= MAX_FLUSH_DELAY_MS;
        const started = overdue ? runFlush() : flush();
        started.catch(error => getLogger().error(`[WatchedFolders] Handling a change in ${folderPath} failed: ${String(error)}`));
      },
      { recursive: true, delayMs: 1000 },
    );
  }
  catch {
    onFolderMissing();
    return () => {};
  }

  return () => {
    // useDebounceFn cannot be cancelled, so an armed flush still fires after
    // the caller let go of this watcher: without the flag it would import into
    // a folder the user just removed, or race the watcher that replaced it.
    stopped = true;
    pending.clear();
    unwatch();
  };
}
