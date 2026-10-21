import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: () => false }));

import { AppFailure } from "@/lib/errors";
import { COMMANDS, invokeCommand, PlatformUnavailableError } from "../tauri-commands";

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: unknown) => error,
  );

describe("invokeCommand", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("forwards the command name and its arguments", async () => {
    mocks.invoke.mockResolvedValue(undefined);

    await expect(invokeCommand(COMMANDS.ytPrefetch, { id: "abc" })).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith("yt_prefetch", { id: "abc" });
  });

  it("calls argument-less commands with the name alone", async () => {
    mocks.invoke.mockResolvedValue("http://127.0.0.1:1/t");

    await invokeCommand(COMMANDS.mediaServerBase);
    expect(mocks.invoke.mock.calls[0]).toEqual(["media_server_base"]);
  });

  it("turns the bridge failure outside Tauri into PlatformUnavailableError", async () => {
    // IS_TAURI is false under happy-dom; the real `invoke` rejects there.
    mocks.invoke.mockRejectedValue(new TypeError("window.__TAURI_INTERNALS__ is undefined"));

    await expect(invokeCommand(COMMANDS.checkUpdate)).rejects.toBeInstanceOf(PlatformUnavailableError);
  });

  it("wraps a serialised envelope in an AppFailure that carries it", async () => {
    const envelope = { domain: "source", source: "ym", kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 1500 };
    mocks.invoke.mockRejectedValue(envelope);

    const error = await rejectionOf(invokeCommand(COMMANDS.ymPrefetch, { trackId: "1" }));

    expect(error).toBeInstanceOf(AppFailure);
    expect((error as AppFailure).error).toEqual(envelope);
    expect((error as AppFailure).message).toBe("slow down");
  });

  it("turns a bare string rejection into native UNKNOWN", async () => {
    mocks.invoke.mockRejectedValue("nd source is not configured");

    const error = await rejectionOf(invokeCommand(COMMANDS.ndPrefetch, { songId: "s1" }));

    expect(error).toBeInstanceOf(AppFailure);
    expect((error as AppFailure).error).toEqual({
      domain: "native",
      kind: "UNKNOWN",
      message: "nd source is not configured",
    });
  });

  it("rethrows an AppFailure untouched", async () => {
    const failure = new AppFailure({ domain: "cancelled", message: "stopped" });
    mocks.invoke.mockRejectedValue(failure);

    await expect(invokeCommand(COMMANDS.ytDownloadCancel, { id: "v1" })).rejects.toBe(failure);
  });

  it("PlatformUnavailableError is an AppFailure of the platform domain naming the command", async () => {
    const bridgeFailure = new TypeError("window.__TAURI_INTERNALS__ is undefined");
    mocks.invoke.mockRejectedValue(bridgeFailure);

    const error = await rejectionOf(invokeCommand(COMMANDS.checkUpdate));

    expect(error).toBeInstanceOf(PlatformUnavailableError);
    expect(error).toBeInstanceOf(AppFailure);
    const failure = error as PlatformUnavailableError;
    expect(failure.error).toEqual({
      domain: "platform",
      command: "check_update",
      message: "\"check_update\" needs the desktop or mobile app; this build runs in the browser",
    });
    expect(failure.command).toBe("check_update");
    expect(failure.reason).toBe(bridgeFailure);
  });
});
