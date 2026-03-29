import { ResultAsync } from "neverthrow";
import type { UpdateChannel, UpdateError, UpdateErrorKind, UpdateInfo } from "../types";
import { invoke } from "@tauri-apps/api/core";

const toUpdateError = (raw: unknown, fallbackKind: UpdateErrorKind = "UNKNOWN"): UpdateError => {
  const message = typeof raw === "string" ? raw : String(raw);

  const kind: UpdateErrorKind = message.includes("network") || message.includes("connect")
    ? "NETWORK"
    : message.includes("invalid channel")
      ? "INVALID_CHANNEL"
      : message.includes("no update available")
        ? "NO_UPDATE_AVAILABLE"
        : fallbackKind;

  return { kind, message };
};

export const installUpdate = (channel: UpdateChannel): ResultAsync<void, UpdateError> =>
  ResultAsync.fromPromise(
    invoke<void>("install_update", { channel }),
    e => toUpdateError(e, "INSTALL_FAILED"),
  );

export const checkUpdate = (channel: UpdateChannel): ResultAsync<UpdateInfo | null, UpdateError> =>
  ResultAsync.fromPromise(
    invoke<UpdateInfo | null>("check_update", { channel }),
    e => toUpdateError(e, "NETWORK"),
  );
