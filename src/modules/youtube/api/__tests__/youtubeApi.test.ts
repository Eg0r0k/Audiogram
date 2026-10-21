import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock(import("@tauri-apps/api/core"), async (importOriginal) => {
  const actual = await importOriginal();
  // The real Channel registers itself in __TAURI_INTERNALS__, absent here.
  class MockChannel {
    onmessage: ((event: unknown) => void) | undefined;
  }
  return { ...actual, invoke: mocks.invoke, Channel: MockChannel as unknown as typeof actual.Channel };
});

import { downloadYoutube, prefetchYoutube } from "../youtubeApi";

describe("youtubeApi errors", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
  });

  it("a cancelled download envelope stays CANCELLED so the manager drops the job", async () => {
    mocks.invoke.mockRejectedValueOnce({ domain: "source", source: "yt", kind: "CANCELLED", message: "cancelled" });

    const error = (await downloadYoutube("v1"))._unsafeUnwrapErr();

    expect(error).toStrictEqual({ kind: "CANCELLED", message: "cancelled" });
  });

  it("maps source kinds one-to-one and INVALID_INPUT to UNKNOWN", async () => {
    mocks.invoke.mockRejectedValueOnce({ domain: "source", source: "yt", kind: "NOT_FOUND", message: "no such stream" });
    expect((await downloadYoutube("v1"))._unsafeUnwrapErr()).toStrictEqual({ kind: "NOT_FOUND", message: "no such stream" });

    mocks.invoke.mockRejectedValueOnce({ domain: "source", source: "yt", kind: "INVALID_INPUT", message: "bad id" });
    expect((await downloadYoutube("v1"))._unsafeUnwrapErr()).toStrictEqual({ kind: "UNKNOWN", message: "bad id" });
  });

  it("turns a platform failure into UNAVAILABLE", async () => {
    mocks.invoke.mockRejectedValueOnce(new TypeError("window.__TAURI_INTERNALS__ is undefined"));

    expect((await prefetchYoutube("v1"))._unsafeUnwrapErr().kind).toBe("UNAVAILABLE");
  });

  it("falls back to the given kind for a native failure", async () => {
    mocks.invoke.mockRejectedValueOnce("no proxy client");

    expect((await downloadYoutube("v1"))._unsafeUnwrapErr()).toStrictEqual({ kind: "DOWNLOAD_FAILED", message: "no proxy client" });
  });
});
