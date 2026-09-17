import { Channel } from "@tauri-apps/api/core";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { ResultAsync } from "neverthrow";
import type {
  YoutubeError,
  YoutubeErrorKind,
  YtDownloadEvent,
  YtDownloadResult,
  YtTrackMeta,
} from "../types";

/** Backend `YtErrorKind` values that map 1:1 onto frontend kinds. */
const BACKEND_KIND_MAP: Partial<Record<string, YoutubeErrorKind>> = {
  NOT_FOUND: "NOT_FOUND",
  // Backend UNAVAILABLE = geoblocked/premium/private content; the frontend
  // reserves plain UNAVAILABLE for "no YouTube on this platform".
  UNAVAILABLE: "UNAVAILABLE_REGION",
  NETWORK: "NETWORK",
  CANCELLED: "CANCELLED",
};

const isStructuredError = (raw: unknown): raw is { kind: string; message: string } =>
  typeof raw === "object" && raw !== null && "kind" in raw && "message" in raw;

const toYoutubeError = (raw: unknown, fallbackKind: YoutubeErrorKind): YoutubeError => {
  if (isStructuredError(raw)) {
    return { kind: BACKEND_KIND_MAP[raw.kind] ?? fallbackKind, message: raw.message };
  }
  if (typeof raw === "string") return { kind: fallbackKind, message: raw };
  const message = raw instanceof Error ? raw.message : String(raw);
  return { kind: fallbackKind, message };
};

export const resolveYoutube = (
  id: string,
): ResultAsync<string, YoutubeError> =>
  ResultAsync.fromPromise(
    invokeCommand(COMMANDS.ytResolve, { id }),
    e => toYoutubeError(e, "DOWNLOAD_FAILED"),
  );

/** Downloads the whole audio into the backend prefetch cache (next-track warm-up). */
export const prefetchYoutube = (
  id: string,
): ResultAsync<void, YoutubeError> =>
  ResultAsync.fromPromise(
    invokeCommand(COMMANDS.ytPrefetch, { id }),
    e => toYoutubeError(e, "NETWORK"),
  );

export const downloadYoutube = (
  id: string,
  onEvent?: (event: YtDownloadEvent) => void,
  meta?: YtTrackMeta,
): ResultAsync<YtDownloadResult, YoutubeError> => {
  const channel = new Channel<YtDownloadEvent>();
  if (onEvent) channel.onmessage = onEvent;

  return ResultAsync.fromPromise(
    invokeCommand(COMMANDS.ytDownload, { id, meta: meta ?? null, onProgress: channel }),
    e => toYoutubeError(e, "DOWNLOAD_FAILED"),
  );
};

export const cancelYoutubeDownload = (id: string): ResultAsync<void, YoutubeError> =>
  ResultAsync.fromPromise(
    invokeCommand(COMMANDS.ytDownloadCancel, { id }),
    e => toYoutubeError(e, "DOWNLOAD_FAILED"),
  );
