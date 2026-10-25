import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "../sleep";

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the given delay", async () => {
    const afterDelay = vi.fn();
    void sleep(100).then(afterDelay);

    await vi.advanceTimersByTimeAsync(99);
    expect(afterDelay).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(afterDelay).toHaveBeenCalledOnce();

    const afterYield = vi.fn();
    void sleep().then(afterYield);

    await Promise.resolve();
    expect(afterYield).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);
    expect(afterYield).toHaveBeenCalledOnce();
  });
});
