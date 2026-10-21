import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn() }) }));

import { DbError } from "@/db/errors/db.errors";
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

describe("query retry policy on normalised errors", () => {
  it("retries a serialised source envelope that is not terminal", () => {
    const envelope = { domain: "source", source: "ym", kind: "UNAVAILABLE", message: "502" };

    expect(shouldRetry(0, envelope)).toBe(true);
    expect(shouldRetry(1, envelope)).toBe(true);
    expect(shouldRetry(2, envelope)).toBe(false);
  });

  it("does not retry INVALID_INPUT", () => {
    expect(shouldRetry(0, new SourceQueryError("INVALID_INPUT", "bad id"))).toBe(false);
    expect(shouldRetry(0, { domain: "source", kind: "INVALID_INPUT", message: "bad id" })).toBe(false);
  });

  it("does not retry a DbError", () => {
    expect(shouldRetry(0, new DbError("NOT_FOUND", "Album not found"))).toBe(false);
    expect(shouldRetry(0, new DbError("UNKNOWN", "transaction aborted"))).toBe(false);
  });

  it("uses retryAfterMs from a plain envelope", () => {
    const envelope = { domain: "source", kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 4_000 };

    expect(retryDelay(0, envelope)).toBe(4_000);
    expect(retryDelay(1, envelope)).toBe(4_000);
  });
});
