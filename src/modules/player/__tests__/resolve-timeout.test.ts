import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { EphemeralTrack, Track } from "../types";

const sourcesMock = vi.hoisted(() => ({ forTrack: vi.fn() }));

vi.mock("@/db/storage", () => ({ storageService: { getAudioUrl: vi.fn() } }));
vi.mock("@/db/repositories", () => ({ trackRepository: { findBySourceRef: vi.fn() } }));
vi.mock("@/modules/sources", () => ({ sources: sourcesMock }));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasFs: true } }));
vi.mock("@/modules/tracks/service/ensurePinned", () => ({ ensurePinned: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { resolveTimeoutMsFor } from "../service/playback-resolver.service";

const libraryTrack = (overrides: Partial<Track> = {}): Track => ({
  id: "track-1" as never,
  kind: "library",
  title: "Test Track",
  artist: "Test Artist",
  artistIds: [],
  albumId: "album-1" as never,
  albumName: "Test Album",
  storagePath: "/path/to/track.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
  ...overrides,
});

const streamTrack = (url: string): EphemeralTrack => ({
  kind: "ephemeral",
  id: "eph-1" as never,
  title: "Stream",
  artist: "",
  duration: 0,
  source: { type: "url", url },
});

describe("resolveTimeoutMsFor", () => {
  beforeEach(() => {
    sourcesMock.forTrack.mockReset();
  });

  it("asks the track's provider how long a resolve may take", () => {
    sourcesMock.forTrack.mockReturnValue({ resolveTimeoutMs: 45_000 });

    const timeout = resolveTimeoutMsFor(libraryTrack({
      id: "yt:dQw4w9WgXcQ" as never,
      source: TrackSource.REMOTE_YT,
      storagePath: "",
    }));

    expect(timeout).toBe(45_000);
    expect(sourcesMock.forTrack).toHaveBeenCalledWith("yt:dQw4w9WgXcQ");
  });

  it("falls back to the shared default when the provider names no timeout", () => {
    sourcesMock.forTrack.mockReturnValue({});

    const remote = resolveTimeoutMsFor(libraryTrack({ id: "nd:s1" as never, source: TrackSource.REMOTE_SUBSONIC }));
    const local = resolveTimeoutMsFor(libraryTrack());

    expect(remote).toBe(local);
    expect(local).toBeGreaterThan(0);
  });

  it("never consults a provider for a local file", () => {
    resolveTimeoutMsFor(libraryTrack());

    expect(sourcesMock.forTrack).not.toHaveBeenCalled();
  });

  it("derives the source of a proxied ephemeral stream from its URL", () => {
    sourcesMock.forTrack.mockReturnValue({ resolveTimeoutMs: 45_000 });

    const timeout = resolveTimeoutMsFor(streamTrack("http://127.0.0.1:4321/tok/yt/dQw4w9WgXcQ"));

    expect(timeout).toBe(45_000);
    expect(sourcesMock.forTrack).toHaveBeenCalledWith("yt:dQw4w9WgXcQ");
  });

  it("treats a plain radio URL as needing no provider", () => {
    const timeout = resolveTimeoutMsFor(streamTrack("https://radio.example/live.m3u8"));

    expect(sourcesMock.forTrack).not.toHaveBeenCalled();
    expect(timeout).toBe(resolveTimeoutMsFor(libraryTrack()));
  });
});
