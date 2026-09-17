import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { YoutubeError } from "../types";

const apiMock = vi.hoisted(() => ({ downloadYoutube: vi.fn() }));
const engineMock = vi.hoisted(() => ({ resolveStream: vi.fn() }));

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));
vi.mock("@/modules/youtube/api/youtubeApi", () => ({
  cancelYoutubeDownload: vi.fn(),
  downloadYoutube: apiMock.downloadYoutube,
  prefetchYoutube: vi.fn(),
  resolveYoutube: vi.fn(),
}));
vi.mock("@/modules/youtube/engine/engine", () => ({ ytEngine: engineMock }));

import { youtubeProvider } from "../provider";

const networkError: YoutubeError = { kind: "NETWORK", message: "socket hang up" };

//
// Retries live in the download manager (downloads/manager.ts, MAX_ATTEMPTS
// with backoff) — the provider must run yt_download exactly once per call,
// otherwise the layers multiply (3 manager attempts × N provider attempts).
//
describe("youtubeProvider.download", () => {
  beforeEach(() => {
    apiMock.downloadYoutube.mockReset();
    engineMock.resolveStream.mockReset();
    engineMock.resolveStream.mockResolvedValue(undefined);
  });

  it("resolves the stream before every download", async () => {
    apiMock.downloadYoutube.mockReturnValue(okAsync({ path: "C:/cache/v1.m4a", ext: "m4a" }));

    await youtubeProvider.download("v1");

    expect(engineMock.resolveStream).toHaveBeenCalledWith("v1");
    expect(engineMock.resolveStream.mock.invocationCallOrder[0])
      .toBeLessThan(apiMock.downloadYoutube.mock.invocationCallOrder[0]);
  });

  it("reports a failed resolve without running yt_download", async () => {
    engineMock.resolveStream.mockRejectedValue(new Error("This video is unavailable"));

    const result = await youtubeProvider.download("v1");

    expect(result._unsafeUnwrapErr()).toEqual({ kind: "NOT_FOUND", message: "This video is unavailable" });
    expect(apiMock.downloadYoutube).not.toHaveBeenCalled();
  });

  it("passes a success through untouched", async () => {
    apiMock.downloadYoutube.mockReturnValue(okAsync({ path: "C:/cache/v1.m4a", ext: "m4a" }));

    const result = await youtubeProvider.download("v1");

    expect(result._unsafeUnwrap()).toEqual({ path: "C:/cache/v1.m4a", ext: "m4a" });
    expect(apiMock.downloadYoutube).toHaveBeenCalledTimes(1);
  });

  it("runs yt_download exactly once even on a transient failure", async () => {
    apiMock.downloadYoutube.mockReturnValue(errAsync(networkError));

    const result = await youtubeProvider.download("v1");

    expect(result._unsafeUnwrapErr()).toEqual(networkError);
    expect(apiMock.downloadYoutube).toHaveBeenCalledTimes(1);
  });
});
