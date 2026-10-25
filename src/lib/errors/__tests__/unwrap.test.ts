import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

import { valueOrThrow } from "../unwrap";

describe("valueOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the value of an ok result", () => {
    const value = { id: "track-1" };

    expect(valueOrThrow(ok(value))).toBe(value);
  });

  it("rethrows the error of an err result as is", () => {
    const error = new Error("transaction aborted");
    let thrown: unknown;

    try {
      valueOrThrow(err(error));
    }
    catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBe(error);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
