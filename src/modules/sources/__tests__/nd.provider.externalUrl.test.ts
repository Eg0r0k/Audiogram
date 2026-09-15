import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumId, TrackId } from "@/types/ids";
import { ndAlbumId, ndTrackId, ytAlbumId } from "@/types/track-ref";

const configState = vi.hoisted(() => ({
  // Mock config for tests only — never a real credential.
  current: { baseUrl: "https://demo.example", username: "joe", password: "sesame" } as object | null,
}));

vi.mock("../navidrome/config", () => ({
  getNdConfig: () => configState.current,
}));
vi.mock(import("@tauri-apps/api/core"), async (importOriginal) => {
  const actual = await importOriginal();
  class MockChannel {
    onmessage: ((event: unknown) => void) | undefined;
  }
  return { ...actual, invoke: vi.fn(), Channel: MockChannel as unknown as typeof actual.Channel };
});

import { ndSourceProvider } from "../providers/nd.provider";

describe("ndSourceProvider.externalUrl", () => {
  beforeEach(() => {
    configState.current = { baseUrl: "https://demo.example", username: "joe", password: "sesame" };
  });

  it("opens the album page of the configured server when the track names an nd album", () => {
    const url = ndSourceProvider.externalUrl?.({ id: ndTrackId("s1"), albumId: ndAlbumId("al1") });

    expect(url).toBe("https://demo.example/app/#/album/al1/show");
  });

  it("falls back to the server root without an album of its own", () => {
    expect(ndSourceProvider.externalUrl?.({ id: ndTrackId("s1") })).toBe("https://demo.example");
    expect(ndSourceProvider.externalUrl?.({ id: ndTrackId("s1"), albumId: ytAlbumId("MPREb_x") })).toBe("https://demo.example");
    expect(ndSourceProvider.externalUrl?.({ id: ndTrackId("s1"), albumId: AlbumId("") })).toBe("https://demo.example");
  });

  it("has nowhere to open without a configured server", () => {
    configState.current = null;

    expect(ndSourceProvider.externalUrl?.({ id: ndTrackId("s1"), albumId: ndAlbumId("al1") })).toBeNull();
  });

  it("refuses a foreign track id", () => {
    expect(ndSourceProvider.externalUrl?.({ id: TrackId("yt:dQw4w9WgXcQ") })).toBeNull();
  });
});
