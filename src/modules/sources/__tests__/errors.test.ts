import { describe, expect, it } from "vitest";
import { PlatformUnavailableError } from "@/app/tauri-commands";
import { AppFailure } from "@/lib/errors";
import { asSourceError } from "../lib/errors";

describe("asSourceError", () => {
  it("passes a source envelope through with retryAfterMs", () => {
    const limited = new AppFailure({ domain: "source", source: "ym", kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 1500 });
    const forbidden = { domain: "source", source: "ym", kind: "FORBIDDEN", message: "premium only" };

    expect(asSourceError(limited)).toStrictEqual({ kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 1500 });
    expect(asSourceError(forbidden)).toStrictEqual({ kind: "FORBIDDEN", message: "premium only" });
  });

  it("turns a platform failure into UNAVAILABLE", () => {
    const failure = new PlatformUnavailableError("ym_request", new TypeError("x"));

    expect(asSourceError(failure)).toStrictEqual({ kind: "UNAVAILABLE", message: failure.message });
  });

  it("turns a cancellation into CANCELLED", () => {
    expect(asSourceError(new AppFailure({ domain: "cancelled", message: "stopped" })))
      .toStrictEqual({ kind: "CANCELLED", message: "stopped" });
    expect(asSourceError(new DOMException("The operation was aborted.", "AbortError")).kind).toBe("CANCELLED");
  });

  it("folds a native envelope and a bare Error into UNKNOWN", () => {
    const native = new AppFailure({ domain: "native", kind: "NETWORK", message: "proxy unreachable" });

    expect(asSourceError(native)).toStrictEqual({ kind: "UNKNOWN", message: "proxy unreachable" });
    expect(asSourceError(new Error("boom"))).toStrictEqual({ kind: "UNKNOWN", message: "boom" });
  });
});
