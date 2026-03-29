import { watch as fsWatch } from "@tauri-apps/plugin-fs";
import { useDebounceFn } from "@vueuse/core";
import { isValidImportItem } from "@/lib/environment/mimeSupport";
import { normalizePath } from "@/lib/files/filterFiles";

export type FileChangeHandler = (paths: string[]) => void;
export type StopWatchFn = () => void;

export async function startWatching(
  folderPath: string,
  onChange: FileChangeHandler,
  excludedPaths?: string[],
): Promise<StopWatchFn> {
  const debouncedHandler = useDebounceFn((changedPaths: string[]) => {
    const audioPaths = changedPaths
      .map(normalizePath)
      .filter((p) => {
        if (!isValidImportItem(p.split("/").pop() ?? "")) return false;
        if (excludedPaths) {
          for (const excluded of excludedPaths) {
            if (p.startsWith(excluded + "/")) return false;
          }
        }
        return true;
      });

    if (audioPaths.length > 0) {
      onChange(audioPaths);
    }
  }, 1500);

  const unwatch = await fsWatch(
    folderPath,
    (event) => {
      if (event.paths.length > 0) {
        debouncedHandler(event.paths);
      }
    },
    { recursive: true, delayMs: 1000 },
  );

  return () => {
    unwatch();
  };
}
