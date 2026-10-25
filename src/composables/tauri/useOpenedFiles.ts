import { EVENTS } from "@/app/tauri-commands";
import { isValidImportItem } from "@/lib/environment/mimeSupport";
import { platformCaps } from "@/lib/environment/platformCaps";
import { fileNameFromPath } from "@/lib/files/path";
import useTauriEvent from "./useTauriEvent";

export interface OpenedFile {
  path: string;
  name: string;
}

export const useOpenedFiles = (onFiles: (files: OpenedFile[]) => void) => {
  if (!platformCaps.hasFs) return;

  useTauriEvent(EVENTS.filesOpened, (event) => {
    const files = event.payload
      .map(path => ({ path, name: fileNameFromPath(path) }))
      .filter(file => isValidImportItem(file.name));

    if (files.length > 0) onFiles(files);
  });
};
