import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import { ResultAsync, okAsync } from "neverthrow";
import { platformCaps } from "@/lib/environment/platformCaps";

export class ProxyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ProxyError";
  }
}

/**
 * The most specific text available: what the cause says about itself, the
 * bare string a Tauri command rejected with, or the caller's fallback.
 */
const messageOf = (cause: unknown, fallback: string): string => {
  if (cause instanceof Error) return cause.message;
  return typeof cause === "string" ? cause : fallback;
};

const toError = (message: string) => (cause: unknown) =>
  new ProxyError(messageOf(cause, message), cause);

type ProxyListener = (url: string | null) => void;

let currentUrl: string | null = null;
const listeners = new Set<ProxyListener>();

/** The proxy URL last pushed by {@link applyProxy} — the same one the TS YouTube transport must use. */
export const currentProxyUrl = (): string | null => currentUrl;

/** Runs `listener` whenever {@link applyProxy} changes the URL; returns the unsubscribe. */
export const onProxyChange = (listener: ProxyListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Pushes the active proxy URL (or `null` to clear) to the Rust side, where the
 * media-server routes pick it up, and to the TS YouTube engine. A no-op outside Tauri.
 */
export const applyProxy = (url: string | null): ResultAsync<void, ProxyError> => {
  if (!platformCaps.hasNativeProxy) return okAsync(undefined);
  if (currentUrl !== url) {
    currentUrl = url;
    listeners.forEach(listener => listener(url));
  }

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
