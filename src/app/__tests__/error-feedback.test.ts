import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ error: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

import { DbError } from "@/db/errors/db.errors";
import type { AppError } from "@/lib/errors";
import { ImportErrorCode, StorageErrorCode } from "@/types/error-codes";
import { i18n } from "../i18n";
import { toaster } from "../toaster";
import { type ErrorHint, hintOf, loadErrorText, reportError } from "../error-feedback";

const offline: AppError = { domain: "source", kind: "NETWORK", message: "offline" };

const onlyToast = () => {
  expect(toaster.toasts.value).toHaveLength(1);
  return toaster.toasts.value[0];
};

describe("hintOf", () => {
  it("hintOf covers every pair in the spec table", () => {
    const cases: [AppError, ErrorHint][] = [
      [{ domain: "source", kind: "NETWORK", message: "" }, "network"],
      [{ domain: "native", kind: "NETWORK", message: "" }, "network"],
      [{ domain: "update", kind: "NETWORK", message: "" }, "network"],
      [{ domain: "source", kind: "UNAVAILABLE", message: "" }, "unavailable"],
      [{ domain: "native", kind: "UNAVAILABLE", message: "" }, "unavailable"],
      [{ domain: "source", kind: "AUTH", message: "" }, "signIn"],
      [{ domain: "source", kind: "FORBIDDEN", message: "" }, "noAccess"],
      [{ domain: "source", kind: "NOT_FOUND", message: "" }, "notFound"],
      [{ domain: "db", code: "NOT_FOUND", message: "" }, "notFound"],
      [{ domain: "source", kind: "RATE_LIMITED", message: "" }, "slowDown"],
      [{ domain: "source", kind: "PARSE", message: "" }, "badResponse"],
      [{ domain: "source", kind: "INVALID_INPUT", message: "" }, "badResponse"],
      [{ domain: "native", kind: "INVALID_INPUT", message: "" }, "badResponse"],
      [{ domain: "db", code: "QUOTA", message: "" }, "storageFull"],
      [{ domain: "storage", code: StorageErrorCode.STORAGE_FULL, message: "" }, "storageFull"],
      [{ domain: "storage", code: StorageErrorCode.FILE_NOT_FOUND, message: "" }, "fileMissing"],
      [{ domain: "import", code: ImportErrorCode.READ_FAILED, message: "" }, "fileMissing"],
      [{ domain: "storage", code: StorageErrorCode.PERMISSION_DENIED, message: "" }, "filePermission"],
      [{ domain: "platform", command: "check_update", message: "" }, "desktopOnly"],
      [{ domain: "storage", code: StorageErrorCode.WRITE_FAILED, message: "" }, "none"],
      [{ domain: "update", kind: "INSTALL_FAILED", message: "" }, "none"],
      [{ domain: "unknown", message: "boom" }, "none"],
    ];

    for (const [error, hint] of cases) {
      expect(hintOf(error), JSON.stringify(error)).toBe(hint);
    }
  });
});

describe("reportError", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  afterEach(() => {
    toaster.clear();
    logger.error.mockClear();
    logger.debug.mockClear();
  });

  it("shows a destructive toast with the title and the hint as description", () => {
    reportError(offline, { title: "Could not load the album", scope: "Album" });

    const toast = onlyToast();
    expect(toast).toMatchObject({
      title: "Could not load the album",
      description: "No connection to the server.",
      color: "destructive",
    });
    expect(toast).not.toHaveProperty("actions");
  });

  it("omits the description for a hint-less error", () => {
    reportError(new Error("boom"), { title: "Could not save", scope: "Settings" });

    expect(onlyToast()).not.toHaveProperty("description");
  });

  it("shows nothing and returns null for a cancellation", () => {
    const result = reportError(new DOMException("The user aborted a request.", "AbortError"), {
      title: "Could not load the album",
      scope: "Album",
    });

    expect(result).toBeNull();
    expect(toaster.toasts.value).toHaveLength(0);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith("[Album] Could not load the album: cancelled");
  });

  it("adds a Retry action when retry is given", () => {
    const retry = vi.fn();

    reportError(offline, { title: "Could not load the album", scope: "Album", retry });

    const [action] = onlyToast()?.actions ?? [];
    expect(action?.label).toBe("Retry");
    action?.onClick?.(new MouseEvent("click"));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("reuses the toast id for dedup", () => {
    const options = { title: "Track skipped", scope: "Queue", id: "queue-track-skipped" };

    reportError(offline, options);
    reportError(new Error("boom"), options);

    expect(onlyToast()).toMatchObject({ id: "queue-track-skipped", title: "Track skipped" });
  });

  it("passes onClose through to the toast", () => {
    const onClose = vi.fn();

    reportError(offline, { title: "Download failed", scope: "Downloads", id: "downloads-failed", onClose });
    toaster.remove("downloads-failed");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("logs scope, title and the formatted error", () => {
    reportError(offline, { title: "Could not create the playlist", scope: "Playlist" });

    expect(logger.error).toHaveBeenCalledWith("[Playlist] Could not create the playlist: source/NETWORK: offline");
  });

  it("returns the normalised error", () => {
    const failure = new DbError("QUOTA", "disk full");

    const result = reportError(failure, { title: "Could not save", scope: "Library" });

    expect(result).toBe(failure.error);
    expect(result).toMatchObject({ domain: "db", code: "QUOTA", message: "disk full" });
  });
});

describe("loadErrorText", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  it("loadErrorText says not found for a DbError NOT_FOUND", () => {
    expect(loadErrorText(new DbError("NOT_FOUND", "Album not found"))).toBe("Not Found");
  });

  it("loadErrorText says load failed with the hint for a network failure", () => {
    expect(loadErrorText(new TypeError("Failed to fetch"))).toBe("Failed to load data. No connection to the server.");
  });
});
