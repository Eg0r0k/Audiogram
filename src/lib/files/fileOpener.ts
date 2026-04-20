import { IS_TAURI } from "../environment/userAgent";
import { isValidImportItem } from "../environment/mimeSupport";

export interface OpenedFile {
  path: string;
  name: string;
}

export async function listenForOpenedFiles(
  callback: (files: OpenedFile[]) => void,
): Promise<() => void> {
  if (!IS_TAURI) return () => {};

  const { listen } = await import("@tauri-apps/api/event");

  const unlisten = await listen<string[]>("files-opened", (event) => {
    const files = event.payload
      .filter(path => isValidImportItem(path.split(/[/\\]/).pop() ?? ""))
      .map(path => ({
        path,
        name: path.split(/[/\\]/).pop() ?? path,
      }));

    if (files.length > 0) {
      callback(files);
    }
  });

  return unlisten;
}
