import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeCommand: vi.fn(), caps: { hasNativeProxy: true } }));

vi.mock("@/app/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/tauri-commands")>();
  return { ...actual, invokeCommand: mocks.invokeCommand };
});
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: mocks.caps }));

import { AppFailure } from "@/lib/errors";
import { applyProxy, checkProxyConnection } from "../proxy";

describe("proxy service", () => {
  beforeEach(() => {
    mocks.invokeCommand.mockReset();
    mocks.caps.hasNativeProxy = true;
  });

  it("applyProxy rejects with a native AppFailure that keeps the cause", async () => {
    const cause = new Error("ipc channel closed");
    mocks.invokeCommand.mockRejectedValueOnce(cause);

    const error = (await applyProxy("socks5://127.0.0.1:1080"))._unsafeUnwrapErr();

    expect(error).toBeInstanceOf(AppFailure);
    expect(error.error).toStrictEqual({ domain: "native", kind: "UNKNOWN", message: "ipc channel closed", cause });
  });

  it("passes an AppFailure from invokeCommand through with its kind", async () => {
    const failure = new AppFailure({ domain: "native", kind: "INVALID_INPUT", message: "invalid proxy url" });
    mocks.invokeCommand.mockRejectedValueOnce(failure);

    const error = (await checkProxyConnection("socks5://bad host"))._unsafeUnwrapErr();

    expect(error).toBe(failure);
  });

  it("checkProxyConnection resolves the latency on success", async () => {
    mocks.invokeCommand.mockResolvedValueOnce(42);

    const result = await checkProxyConnection("http://127.0.0.1:8080");

    expect(result._unsafeUnwrap()).toBe(42);
    expect(mocks.invokeCommand).toHaveBeenCalledWith("proxy_check", { url: "http://127.0.0.1:8080" });
  });

  it("rejects with native UNAVAILABLE outside Tauri", async () => {
    mocks.caps.hasNativeProxy = false;

    const error = (await checkProxyConnection("http://127.0.0.1:8080"))._unsafeUnwrapErr();

    expect(error.error).toStrictEqual({ domain: "native", kind: "UNAVAILABLE", message: "Proxy check needs the desktop app" });
    expect(mocks.invokeCommand).not.toHaveBeenCalled();
  });
});
