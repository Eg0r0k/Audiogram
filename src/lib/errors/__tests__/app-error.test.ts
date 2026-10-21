import { describe, expect, it } from "vitest";
import { DbError, toDbError } from "@/db/errors/db.errors";
import { StorageError } from "@/db/errors/storage.errors";
import { ImportError } from "@/services/types";
import {
  formatError,
  isCancelled,
  isNotFound,
  isRetryable,
  TERMINAL_SOURCE_ERRORS,
  toAppError,
  type AppError,
} from "../app-error";
import { AppFailure } from "../app-failure";

const UNKNOWN_ERROR = { domain: "unknown", message: "Unknown error" };

describe("toAppError", () => {
  it("returns the envelope of an AppFailure", () => {
    const envelope: AppError = { domain: "native", kind: "IO", message: "disk" };
    expect(toAppError(new AppFailure(envelope))).toBe(envelope);

    const dbError = new DbError("QUOTA", "full");
    expect(toAppError(dbError)).toBe(dbError.error);
  });

  it("takes a serialised envelope as it is", () => {
    const source = { domain: "source", source: "ym", kind: "AUTH", message: "x" };
    expect(toAppError(source)).toBe(source);

    const native = { domain: "native", kind: "IO", message: "disk" };
    expect(toAppError(native)).toBe(native);
  });

  it("wraps a bare SourceError into the source domain", () => {
    expect(toAppError({ kind: "RATE_LIMITED", message: "slow", retryAfterMs: 500 })).toEqual({
      domain: "source",
      kind: "RATE_LIMITED",
      message: "slow",
      retryAfterMs: 500,
    });
  });

  it("rejects a plain object whose domain is unknown", () => {
    expect(toAppError({ domain: "weird", message: "x" })).toEqual(UNKNOWN_ERROR);
    expect(toAppError({ domain: "weird", kind: "AUTH", message: "x" })).toEqual(UNKNOWN_ERROR);
    expect(toAppError({ domain: "db", message: "no code" })).toEqual(UNKNOWN_ERROR);
  });

  it("maps an AbortError to cancelled", () => {
    const abort = new DOMException("The user aborted a request.", "AbortError");
    expect(toAppError(abort)).toEqual({ domain: "cancelled", message: "The user aborted a request." });
  });

  it("maps fetch's TypeError to native NETWORK", () => {
    const chromium = new TypeError("Failed to fetch");
    expect(toAppError(chromium)).toEqual({ domain: "native", kind: "NETWORK", message: "Failed to fetch", cause: chromium });
    expect(toAppError(new TypeError("NetworkError when attempting to fetch resource."))).toMatchObject({ domain: "native", kind: "NETWORK" });
    expect(toAppError(new TypeError("Load failed"))).toMatchObject({ domain: "native", kind: "NETWORK" });
  });

  it("keeps an Error as unknown with the error as cause", () => {
    const error = new RangeError("boom");
    expect(toAppError(error)).toEqual({ domain: "unknown", message: "boom", cause: error });

    const notNetwork = new TypeError("x is not a function");
    expect(toAppError(notNetwork)).toEqual({ domain: "unknown", message: "x is not a function", cause: notNetwork });

    const empty = new Error("");
    expect(toAppError(empty)).toEqual({ domain: "unknown", message: "Error", cause: empty });
  });

  it("keeps a string rejection as its message", () => {
    expect(toAppError("cancelled")).toEqual({ domain: "unknown", message: "cancelled" });
  });

  it("falls back to Unknown error for undefined and null", () => {
    expect(toAppError(undefined)).toEqual(UNKNOWN_ERROR);
    expect(toAppError(null)).toEqual(UNKNOWN_ERROR);
  });
});

describe("predicates", () => {
  it("isCancelled covers the three cancellation shapes", () => {
    expect(isCancelled({ domain: "cancelled", message: "stop" })).toBe(true);
    expect(isCancelled({ domain: "source", kind: "CANCELLED", message: "stop" })).toBe(true);
    expect(isCancelled(ImportError.cancelled("a.mp3").error)).toBe(true);

    expect(isCancelled({ domain: "source", kind: "NETWORK", message: "offline" })).toBe(false);
    expect(isCancelled(ImportError.parseFailed("a.mp3").error)).toBe(false);
    expect(isCancelled({ domain: "unknown", message: "cancelled" })).toBe(false);
  });

  it("isNotFound covers db, storage and source", () => {
    expect(isNotFound(new DbError("NOT_FOUND", "Album not found").error)).toBe(true);
    expect(isNotFound(StorageError.fileNotFound("/a.mp3").error)).toBe(true);
    expect(isNotFound({ domain: "source", kind: "NOT_FOUND", message: "gone" })).toBe(true);

    expect(isNotFound(new DbError("QUOTA", "full").error)).toBe(false);
    expect(isNotFound(StorageError.readFailed("/a.mp3").error)).toBe(false);
    expect(isNotFound({ domain: "source", kind: "AUTH", message: "nope" })).toBe(false);
    expect(isNotFound({ domain: "unknown", message: "Album not found" })).toBe(false);
  });

  it("isRetryable: source kinds outside the terminal set, native and update NETWORK, nothing else", () => {
    expect(TERMINAL_SOURCE_ERRORS).toEqual(new Set(["PARSE", "AUTH", "FORBIDDEN", "NOT_FOUND", "CANCELLED", "INVALID_INPUT"]));

    for (const kind of ["NETWORK", "UNAVAILABLE", "RATE_LIMITED", "UNKNOWN"] as const) {
      expect(isRetryable({ domain: "source", kind, message: "" })).toBe(true);
    }
    for (const kind of TERMINAL_SOURCE_ERRORS) {
      expect(isRetryable({ domain: "source", kind, message: "" })).toBe(false);
    }

    expect(isRetryable({ domain: "native", kind: "NETWORK", message: "" })).toBe(true);
    expect(isRetryable({ domain: "update", kind: "NETWORK", message: "" })).toBe(true);

    expect(isRetryable({ domain: "native", kind: "IO", message: "" })).toBe(false);
    expect(isRetryable({ domain: "update", kind: "INSTALL_FAILED", message: "" })).toBe(false);
    expect(isRetryable(new DbError("CLOSED", "closed").error)).toBe(false);
    expect(isRetryable({ domain: "platform", message: "" })).toBe(false);
    expect(isRetryable({ domain: "cancelled", message: "" })).toBe(false);
    expect(isRetryable({ domain: "unknown", message: "" })).toBe(false);
  });
});

describe("formatError", () => {
  it("formatError prints domain, code and message", () => {
    expect(formatError(new DbError("QUOTA", "full"))).toBe("db/QUOTA: full");
    expect(formatError({ domain: "source", source: "ym", kind: "AUTH", message: "nope" })).toBe("source/AUTH: nope");
    expect(formatError({ domain: "platform", command: "yt_prefetch", message: "Desktop only" })).toBe("platform/yt_prefetch: Desktop only");
    expect(formatError({ domain: "platform", message: "Desktop only" })).toBe("platform: Desktop only");
    expect(formatError({ domain: "cancelled", message: "stop" })).toBe("cancelled: stop");
    expect(formatError("plain")).toBe("unknown: plain");
  });

  it("formatError names the Error class for an unknown envelope", () => {
    expect(formatError(new TypeError("boom"))).toBe("unknown/TypeError: boom");
    expect(formatError(new RangeError(""))).toBe("unknown/RangeError: RangeError");
  });

  it("formatError appends one level of cause", () => {
    expect(formatError(new DbError("QUOTA", "full", new Error("disk")))).toBe("db/QUOTA: full <- disk");
    expect(formatError(StorageError.readFailed("/a.mp3", "denied"))).toBe("storage/READ_FAILED: Read failed: /a.mp3 <- denied");

    const deep = Object.assign(new Error("disk"), { cause: new Error("sector") });
    expect(formatError(new DbError("QUOTA", "full", deep))).toBe("db/QUOTA: full <- disk");

    expect(formatError(toDbError(new Error("boom")))).toBe("db/UNKNOWN: boom");
    expect(formatError(Object.assign(new Error("write"), { cause: new Error("disk") }))).toBe("unknown/Error: write <- disk");
  });

  it("formatError does not repeat a string cause equal to the message", () => {
    const failure = new AppFailure({ domain: "native", kind: "UNKNOWN", message: "plugin said no", cause: "plugin said no" });

    expect(formatError(failure)).toBe("native/UNKNOWN: plugin said no");
  });

  it("formatError never prints [object Object]", () => {
    expect(formatError({ foo: 1 })).toBe("unknown: Unknown error");

    const withObjectCause = formatError(new DbError("UNKNOWN", "x", { foo: 1 }));
    expect(withObjectCause).toBe("db/UNKNOWN: x <- Unknown error");
    expect(withObjectCause).not.toContain("[object Object]");
  });
});
