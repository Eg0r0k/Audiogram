import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ResultAsync, okAsync } from "neverthrow";
import { ndTrackId } from "@/types/track-ref";
import type { SourceError } from "@/modules/sources/types";

const providerMock = vi.hoisted(() => ({
  downloadToFile: vi.fn(),
  cancelDownload: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));
vi.mock("@/modules/sources", () => ({
  sources: { forTrack: () => providerMock },
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  readDir: vi.fn(async () => []),
  remove: vi.fn(async () => {}),
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("../service/finalize", () => ({
  finalizeDownloadImport: vi.fn(async () => {}),
}));

import { db } from "@/db";

const failingWith = (error: SourceError) => () =>
  ResultAsync.fromPromise(Promise.reject(error), e => e as SourceError);

const freshManager = async () => {
  vi.resetModules();
  return import("../service/manager");
};

describe("download manager — subscription and rate-limit failures", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    providerMock.downloadToFile.mockReset();
    toastMock.error.mockReset();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a forbidden download is terminal: no subscription appears on retry", async () => {
    providerMock.downloadToFile.mockImplementation(
      failingWith({ kind: "FORBIDDEN", message: "premium only" }),
    );
    const manager = await freshManager();

    await manager.enqueueTrackDownload(ndTrackId("s1"));

    await vi.waitFor(async () => {
      const [job] = await db.downloadJobs.toArray();
      expect(job).toMatchObject({ status: "error", attempts: 1, error: "premium only" });
    });
    expect(providerMock.downloadToFile).toHaveBeenCalledTimes(1);
  });

  it("a rate-limited download waits out the Retry-After before its retry", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    providerMock.downloadToFile
      .mockImplementationOnce(failingWith({ kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 8_000 }))
      .mockImplementationOnce(() => okAsync({ path: "C:/tmp/s1.mp3" }));
    const manager = await freshManager();

    await manager.enqueueTrackDownload(ndTrackId("s1"));
    await vi.waitFor(async () => {
      const [job] = await db.downloadJobs.toArray();
      expect(job).toMatchObject({ status: "queued", attempts: 1 });
    });
    await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));

    // The default backoff (5 s) would have retried by now; the source's own
    // wait is longer and wins.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(providerMock.downloadToFile).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.waitFor(async () => {
      expect(await db.downloadJobs.count()).toBe(0);
    });
    expect(providerMock.downloadToFile).toHaveBeenCalledTimes(2);
  });
});
