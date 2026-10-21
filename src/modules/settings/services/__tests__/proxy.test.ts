import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock(import("@tauri-apps/api/core"), async (importOriginal) => ({ ...(await importOriginal()), invoke: mocks.invoke }));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasNativeProxy: true } }));

import { AppFailure } from "@/lib/errors";
import { applyProxy, checkProxyConnection } from "../proxy";

describe("proxy service", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("applyProxy rejects with a native AppFailure that keeps the cause", async () => {
    mocks.invoke.mockRejectedValueOnce("proxy lock poisoned");

    const error = (await applyProxy("socks5://127.0.0.1:1080"))._unsafeUnwrapErr();

    expect(error).toBeInstanceOf(AppFailure);
    expect(error.error).toMatchObject({ domain: "native", kind: "UNKNOWN", message: "proxy lock poisoned" });
    const cause = error.error.cause;
    expect(cause).toBeInstanceOf(AppFailure);
    expect((cause as AppFailure).error).toStrictEqual({ domain: "native", kind: "UNKNOWN", message: "proxy lock poisoned" });
  });

  it("checkProxyConnection resolves the latency on success", async () => {
    mocks.invoke.mockResolvedValueOnce(42);

    const result = await checkProxyConnection("http://127.0.0.1:8080");

    expect(result._unsafeUnwrap()).toBe(42);
    expect(mocks.invoke).toHaveBeenCalledWith("proxy_check", { url: "http://127.0.0.1:8080" });
  });
});
