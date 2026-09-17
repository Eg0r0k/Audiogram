import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn() }) }));

import { queryClient } from "../client";
import { SourceQueryError } from "../shared";

const defaults = queryClient.getDefaultOptions().queries;

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const retry = defaults?.retry;
  if (typeof retry !== "function") throw new TypeError("expected a retry predicate");
  return retry(failureCount, error as Error) as boolean;
};

const retryDelay = (failureCount: number, error: unknown): number => {
  const delay = defaults?.retryDelay;
  if (typeof delay !== "function") throw new TypeError("expected a retry delay function");
  return delay(failureCount, error as Error);
};

describe("query retry policy — subscription and rate limits", () => {
  it("does not retry a forbidden answer: the subscription will not appear on the second try", () => {
    expect(shouldRetry(0, new SourceQueryError("FORBIDDEN", "premium only"))).toBe(false);
  });

  it("retries a rate-limited answer", () => {
    expect(shouldRetry(0, new SourceQueryError("RATE_LIMITED", "slow down"))).toBe(true);
  });

  it("waits as long as the source asked before retrying a rate-limited answer", () => {
    const error = new SourceQueryError("RATE_LIMITED", "slow down", 7_000);

    expect(retryDelay(0, error)).toBe(7_000);
    expect(retryDelay(1, error)).toBe(7_000);
  });

  it("keeps a growing backoff for failures without a Retry-After", () => {
    const first = retryDelay(0, new SourceQueryError("NETWORK", "offline"));
    const second = retryDelay(1, new SourceQueryError("NETWORK", "offline"));

    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });
});
