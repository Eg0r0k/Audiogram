import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { ResultAsync } from "neverthrow";
import { AppFailure, errorMessage, type NativeAppError } from "@/lib/errors";

const toNativeFailure = (message: string) => (cause: unknown) =>
  new AppFailure<NativeAppError>({ domain: "native", kind: "UNKNOWN", message: errorMessage(cause, message), cause });

const wrap = <T>(fn: () => Promise<T>, message: string) =>
  ResultAsync.fromPromise(fn(), toNativeFailure(message));

export const autostartService = {
  enable: () => wrap(enable, "Failed to enable autostart"),
  disable: () => wrap(disable, "Failed to disable autostart"),
  isEnabled: () => wrap(isEnabled, "Failed to check autostart state"),
};
