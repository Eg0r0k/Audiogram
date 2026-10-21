import { toAppError } from "@/lib/errors";
import { Channel } from "@tauri-apps/api/core";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { ResultAsync } from "neverthrow";
import type { SourceErrorKind } from "@/types/source-dto";
import type {
  YoutubeError,
  YoutubeErrorKind,
  YtDownloadEvent,
  YtDownloadResult,
  YtTrackMeta,
} from "../types";

const SOURCE_KIND_MAP: Partial<Record<SourceErrorKind, YoutubeErrorKind>> = {
  UNAVAILABLE: "UNAVAILABLE",
  NOT_FOUND: "NOT_FOUND",
  NETWORK: "NETWORK",
  CANCELLED: "CANCELLED",
  UNKNOWN: "UNKNOWN",
};

const toYoutubeError = (raw: unknown, fallbackKind: YoutubeErrorKind): YoutubeError => {
  const error = toAppError(raw);
  switch (error.domain) {
    case "source":
      return { kind: SOURCE_KIND_MAP[error.kind] ?? "UNKNOWN", message: error.message };
    case "platform":
      return { kind: "UNAVAILABLE", message: error.message };
    case "cancelled":
      return { kind: "CANCELLED", message: error.message };
    default:
      return { kind: fallbackKind, message: error.message };
  }
};

/** Hands the engine's resolved googlevideo stream to the Rust `yt/` route, prefetch and download. */
export const registerYoutubeStream = (
  id: string,
  stream: { url: string; headers: [string, string][]; expiresAt: number | null },
): ResultAsync<void, YoutubeError> =>
  ResultAsync.fromPromise(
    invokeCommand(COMMANDS.ytRegisterStream, {
      id,
      url: stream.url,
      headers: stream.headers,
      expiresAt: stream.expiresAt,
    }),
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
