import { beforeEach, describe, expect, it } from "vitest";
import { forgetSourceHealth, reportSourceError, sourceHealth } from "../health";

describe("source health — which failures describe the source", () => {
  beforeEach(() => {
    forgetSourceHealth();
  });

  it("records a forbidden answer: the account, not the request, is what is lacking", () => {
    reportSourceError("nd", { kind: "FORBIDDEN", message: "premium only" });

    expect(sourceHealth("nd")).toEqual({ state: "failed", error: { kind: "FORBIDDEN", message: "premium only" } });
  });

  it("records a rate limit with the wait the source asked for", () => {
    reportSourceError("nd", { kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 5_000 });

    expect(sourceHealth("nd")).toEqual({
      state: "failed",
      error: { kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 5_000 },
    });
  });

  it("still ignores failures about the request itself", () => {
    reportSourceError("nd", { kind: "NOT_FOUND", message: "no such album" });
    reportSourceError("nd", { kind: "PARSE", message: "bad json" });

    expect(sourceHealth("nd")).toEqual({ state: "unknown" });
  });
});
