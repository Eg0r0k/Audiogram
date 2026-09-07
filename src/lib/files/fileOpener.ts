import { platformCaps } from "../environment/platformCaps";
import { isValidImportItem } from "../environment/mimeSupport";
import { EVENTS, listenEvent } from "@/app/tauri-commands";

export interface OpenedFile {
  path: string;
  name: string;
}

export async function listenForOpenedFiles(
  callback: (files: OpenedFile[]) => void,
): Promise<() => void> {
  if (!platformCaps.hasFs) return () => {};

  const unlisten = await listenEvent(EVENTS.filesOpened, (event) => {
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
