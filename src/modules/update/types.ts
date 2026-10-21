export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body: string | null;
  date: string | null;
}

export interface DownloadProgress {
  chunkLength: number;
  contentLength: number | null;
}

export type UpdateStatus
  = | "idle"
    | "checking"
    | "available"
    | "up-to-date"
    | "downloading"
    | "installing"
    | "error";

export type { UpdateError, UpdateErrorKind } from "@/types/update-error";

export type UpdateChannel = "stable";

/** Service Worker equivalents of the Tauri check/install commands. */
export interface PwaUpdateHandlers {
  check: () => Promise<void>;
  apply: () => Promise<void>;
}
