import { beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";

const mocks = vi.hoisted(() => ({
  forTrack: vi.fn(),
  resolveStreamUrl: vi.fn(),
}));

vi.mock("@/modules/sources", () => ({ sources: { forTrack: mocks.forTrack } }));
vi.mock("@/db/storage", () => ({ storageService: { getAudioUrl: vi.fn() } }));
vi.mock("@/db/repositories", () => ({ trackRepository: { findBySourceRef: vi.fn() } }));
vi.mock("@/modules/tracks/service/ensurePinned", () => ({ ensurePinned: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));

import { setMediaServerBaseForTests, ytStreamUrl } from "@/lib/stream-url";
import { ephemeralFromUrl } from "@/modules/player/types";
import { resolvePlaybackSource } from "../playback-resolver.service";

const BASE = "http://127.0.0.1:4321/tokentokentokentokentokentokento";

//
// A YouTube track queued from search is an ephemeral `…/yt/<id>` URL. Rust
// used to resolve the googlevideo URL on the route's first miss; now the
// engine in the webview must register it before the element loads, so the
// ephemeral path has to run the source's resolve like a library track does.
//
describe("resolvePlaybackSource for ephemeral proxied streams", () => {
  beforeEach(() => {
    setMediaServerBaseForTests(BASE);
    mocks.forTrack.mockReset();
    mocks.resolveStreamUrl.mockReset();
    mocks.forTrack.mockReturnValue({ resolveStreamUrl: mocks.resolveStreamUrl });
  });

  it("resolves a proxied YouTube stream through its source before playing it", async () => {
    const url = ytStreamUrl("dQw4w9WgXcQ");
    mocks.resolveStreamUrl.mockReturnValue(okAsync(url));

    const result = await resolvePlaybackSource(ephemeralFromUrl(url, { title: "t" }));

    expect(mocks.forTrack).toHaveBeenCalledWith("yt:dQw4w9WgXcQ");
    expect(mocks.resolveStreamUrl).toHaveBeenCalledWith("yt:dQw4w9WgXcQ");
    expect(result._unsafeUnwrap()).toEqual({ kind: "url", url, corsFallback: true });
  });

  it("plays a plain remote URL as it is", async () => {
    const result = await resolvePlaybackSource(ephemeralFromUrl("https://radio.example/live", { title: "r" }));

    expect(mocks.forTrack).not.toHaveBeenCalled();
    expect(result._unsafeUnwrap()).toEqual({ kind: "url", url: "https://radio.example/live", corsFallback: true });
  });

  it("surfaces a failed resolve as a source error", async () => {
    mocks.resolveStreamUrl.mockReturnValue(errAsync({ kind: "NOT_FOUND", message: "This video is unavailable" }));

    const result = await resolvePlaybackSource(ephemeralFromUrl(ytStreamUrl("aaaaaaaaaaa"), { title: "t" }));

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "source", cause: { kind: "NOT_FOUND" } });
  });
});
