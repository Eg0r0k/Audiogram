import { describe, expect, it } from "vitest";
import { formatDownloadProgress } from "../formatDownloadProgress";

describe("formatDownloadProgress", () => {
  it("shows downloaded of total with a percent when the size is known", () => {
    expect(formatDownloadProgress(12.3 * 1024 * 1024, 45.6 * 1024 * 1024)).toBe("12.3 MB / 45.6 MB · 27%");
  });

  it("shows only the downloaded bytes when the server sent no size", () => {
    expect(formatDownloadProgress(12.3 * 1024 * 1024, null)).toBe("12.3 MB");
  });

  it("never exceeds 100% when the stream runs past the announced size", () => {
    expect(formatDownloadProgress(2048, 1024)).toBe("2.0 KB / 1.0 KB · 100%");
  });

  it("returns null before the first byte arrives", () => {
    expect(formatDownloadProgress(0, null)).toBeNull();
  });
});
