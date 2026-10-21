import { AppFailure, errorMessage, type NativeAppError } from "@/lib/errors";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { platformCaps } from "@/lib/environment/platformCaps";

const toNativeFailure = (message: string) => (cause: unknown) =>
  new AppFailure<NativeAppError>({ domain: "native", kind: "UNKNOWN", message: errorMessage(cause, message), cause });

let currentUrl: string | null = null;

/** The proxy URL last pushed by {@link applyProxy} — the same one the TS YouTube transport must use. */
export const currentProxyUrl = (): string | null => currentUrl;

/**
 * Pushes the active proxy URL (or `null` to clear) to the Rust side, where the
 * media-server routes pick it up, and to the TS YouTube engine. A no-op outside Tauri.
 */
export const applyProxy = (url: string | null): ResultAsync<void, AppFailure<NativeAppError>> => {
  if (!platformCaps.hasNativeProxy) return okAsync(undefined);
  currentUrl = url;

  return ResultAsync.fromPromise(
    invokeCommand(COMMANDS.setProxy, { url }),
    toNativeFailure("Failed to apply proxy"),
  );
};

/**
 * Verifies the proxy connects by routing a request through it. Resolves with the
 * round-trip latency in milliseconds.
 */
export const checkProxyConnection = (url: string): ResultAsync<number, AppFailure<NativeAppError>> => {
  if (!platformCaps.hasNativeProxy) {
    return errAsync(toNativeFailure("Proxy is only available in the desktop app")(undefined));
  }

  return ResultAsync.fromPromise(
    invokeCommand(COMMANDS.proxyCheck, { url }),
    toNativeFailure("Proxy connection failed"),
  );
};
