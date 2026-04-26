import { ResultAsync } from "neverthrow";
import type { UpdateError, UpdateErrorKind, UpdateInfo } from "../types";
import { invoke } from "@tauri-apps/api/core";

function getErrorKind(message: string, fallbackKind: UpdateErrorKind): UpdateErrorKind {
  if (message.includes("network") || message.includes("connect")) return "NETWORK";
  if (message.includes("invalid channel")) return "INVALID_CHANNEL";
  if (message.includes("no update available")) return "NO_UPDATE_AVAILABLE";
  return fallbackKind;
}

const toUpdateError = (raw: unknown, fallbackKind: UpdateErrorKind = "UNKNOWN"): UpdateError => {
  const message = typeof raw === "string" ? raw : String(raw);
  return { kind: getErrorKind(message, fallbackKind), message };
};

export const installUpdate = (): ResultAsync<void, UpdateError> =>
  ResultAsync.fromPromise(
    invoke<void>("install_update"),
    e => toUpdateError(e, "INSTALL_FAILED"),
  );

export const checkUpdate = (): ResultAsync<UpdateInfo | null, UpdateError> =>
  ResultAsync.fromPromise(
    invoke<UpdateInfo | null>("check_update"),
    e => toUpdateError(e, "NETWORK"),
  );
