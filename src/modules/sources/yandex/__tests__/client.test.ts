import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeCommand = vi.hoisted(() => vi.fn());

vi.mock("@/app/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/tauri-commands")>();
  return { ...actual, invokeCommand };
});

import { PlatformUnavailableError } from "@/app/tauri-commands";
import { mapYmError, ymApi, ymRequest } from "../api/client";

describe("ymRequest", () => {
  beforeEach(() => {
    invokeCommand.mockReset();
  });

  it("hands the request to Rust untouched — {uid} is Rust's to fill in", async () => {
    invokeCommand.mockResolvedValue([]);

    const result = await ymApi.likedAlbums();

    expect(result._unsafeUnwrap()).toEqual([]);
    expect(invokeCommand).toHaveBeenCalledWith("ym_request", {
      req: { path: "/users/{uid}/likes/albums", query: { rich: "true" } },
    });
  });

  it("posts a track batch as a form so a long id list never hits a URL limit", async () => {
    invokeCommand.mockResolvedValue([]);

    await ymApi.tracks(["40144", "38633756"]);

    expect(invokeCommand).toHaveBeenCalledWith("ym_request", {
      req: { method: "POST", path: "/tracks", form: { "track-ids": "40144,38633756" } },
    });
  });

  it("posts entity likes as forms under the same scheme as track likes", async () => {
    invokeCommand.mockResolvedValue("ok");

    await ymApi.likeArtists(["41075"]);
    await ymApi.unlikeAlbums(["5307396", "10374"]);
    await ymApi.likePlaylists(["457553308:1000"]);

    expect(invokeCommand).toHaveBeenNthCalledWith(1, "ym_request", {
      req: { method: "POST", path: "/users/{uid}/likes/artists/add-multiple", form: { "artist-ids": "41075" } },
    });
    expect(invokeCommand).toHaveBeenNthCalledWith(2, "ym_request", {
      req: { method: "POST", path: "/users/{uid}/likes/albums/remove", form: { "album-ids": "5307396,10374" } },
    });
    expect(invokeCommand).toHaveBeenNthCalledWith(3, "ym_request", {
      req: { method: "POST", path: "/users/{uid}/likes/playlists/add-multiple", form: { "playlist-ids": "457553308:1000" } },
    });
  });

  it("deletes an own playlist by kind under the account's uid", async () => {
    invokeCommand.mockResolvedValue("ok");

    await ymApi.deletePlaylist("1000");

    expect(invokeCommand).toHaveBeenCalledWith("ym_request", {
      req: { method: "POST", path: "/users/{uid}/playlists/1000/delete" },
    });
  });

  it("returns the unwrapped result Rust hands over", async () => {
    invokeCommand.mockResolvedValue({ account: { uid: 42 }, plus: { hasPlus: true } });

    const result = await ymRequest<{ account: { uid: number } }>({ path: "/account/status" });

    expect(result._unsafeUnwrap().account.uid).toBe(42);
  });

  it("carries the Rust error kind and Retry-After across one-to-one", async () => {
    invokeCommand.mockRejectedValue({ kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 3000 });

    const result = await ymRequest({ path: "/tracks" });

    expect(result._unsafeUnwrapErr()).toEqual({ kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 3000 });
  });

  it("keeps FORBIDDEN and AUTH apart — one needs Plus, the other a sign-in", async () => {
    invokeCommand.mockRejectedValueOnce({ kind: "FORBIDDEN", message: "premium only" });
    expect((await ymRequest({ path: "/tracks" }))._unsafeUnwrapErr().kind).toBe("FORBIDDEN");

    invokeCommand.mockRejectedValueOnce({ kind: "AUTH", message: "session expired" });
    expect((await ymRequest({ path: "/tracks" }))._unsafeUnwrapErr().kind).toBe("AUTH");
  });
});

describe("mapYmError", () => {
  it("names the platform when the bridge is missing", () => {
    expect(mapYmError(new PlatformUnavailableError("ym_request", new TypeError("x"))).kind).toBe("UNAVAILABLE");
  });

  it("falls back to UNKNOWN for shapes it does not recognise", () => {
    expect(mapYmError(new Error("boom"))).toEqual({ kind: "UNKNOWN", message: "boom" });
    expect(mapYmError("plain")).toEqual({ kind: "UNKNOWN", message: "plain" });
    expect(mapYmError({ kind: "WEIRD", message: "?" })).toEqual({ kind: "UNKNOWN", message: "?" });
  });
});
