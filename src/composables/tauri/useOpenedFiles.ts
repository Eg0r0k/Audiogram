import { EVENTS } from "@/app/tauri-commands";
import { isValidImportItem } from "@/lib/environment/mimeSupport";
import { platformCaps } from "@/lib/environment/platformCaps";
import useTauriEvent from "./useTauriEvent";

export interface OpenedFile {
  path: string;
  name: string;
}

const fileName = (path: string) => path.split(/[/\\]/).pop() ?? path;

export const useOpenedFiles = (onFiles: (files: OpenedFile[]) => void) => {
  if (!platformCaps.hasFs) return;

  useTauriEvent(EVENTS.filesOpened, (event) => {
    const files = event.payload
      .map(path => ({ path, name: fileName(path) }))
      .filter(file => isValidImportItem(file.name));

    if (files.length > 0) onFiles(files);
  });
};
