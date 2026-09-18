import { errorMessage } from "@/lib/errors";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { ResultAsync, okAsync } from "neverthrow";
import { platformCaps } from "@/lib/environment/platformCaps";

export class ProxyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ProxyError";
  }
}

const toError = (message: string) => (cause: unknown) =>
  new ProxyError(errorMessage(cause, message), cause);

let currentUrl: string | null = null;

/** The proxy URL last pushed by {@link applyProxy} — the same one the TS YouTube transport must use. */
export const currentProxyUrl = (): string | null => currentUrl;

/**
 * Pushes the active proxy URL (or `null` to clear) to the Rust side, where the
 * media-server routes pick it up, and to the TS YouTube engine. A no-op outside Tauri.
 */
export const applyProxy = (url: string | null): ResultAsync<void, ProxyError> => {
  if (!platformCaps.hasNativeProxy) return okAsync(undefined);
  currentUrl = url;

  return ResultAsync.fromPromise(
    invokeCommand(COMMANDS.setProxy, { url }),
    toError("Failed to apply proxy"),
  );
};

/**
 * Verifies the proxy connects by routing a request through it. Resolves with the
 * round-trip latency in milliseconds.
 */
export const checkProxyConnection = (url: string): ResultAsync<number, ProxyError> => {
  if (!platformCaps.hasNativeProxy) {
    return ResultAsync.fromPromise(
      Promise.reject(new ProxyError("Proxy is only available in the desktop app")),
      toError("Proxy is only available in the desktop app"),
    );
  }

  return ResultAsync.fromPromise(
    invokeCommand(COMMANDS.proxyCheck, { url }),
    toError("Proxy connection failed"),
  );
};
