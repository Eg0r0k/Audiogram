import { ResultAsync } from "neverthrow";
import type { UpdateError, UpdateErrorKind, UpdateInfo } from "../types";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { toAppError } from "@/lib/errors";
import { IS_MOBILE } from "@/lib/environment/userAgent";
import { checkUpdateAndroid, installUpdateAndroid } from "./androidUpdateApi";

const toUpdateError = (raw: unknown, fallback: UpdateErrorKind): UpdateError => {
  const error = toAppError(raw);
  return error.domain === "update" ? { kind: error.kind, message: error.message } : { kind: fallback, message: error.message };
};

export const installUpdate = (): ResultAsync<void, UpdateError> =>
  IS_MOBILE
    ? installUpdateAndroid()
    : ResultAsync.fromPromise(
        invokeCommand(COMMANDS.installUpdate),
        e => toUpdateError(e, "INSTALL_FAILED"),
      );

export const checkUpdate = (): ResultAsync<UpdateInfo | null, UpdateError> =>
  IS_MOBILE
    ? checkUpdateAndroid()
    : ResultAsync.fromPromise(
        invokeCommand(COMMANDS.checkUpdate),
        e => toUpdateError(e, "NETWORK"),
      );
