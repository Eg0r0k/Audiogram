import { describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/types/track";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
vi.mock("@/db/repositories", () => ({ trackRepository: { findBySourceRef: vi.fn() } }));

import { createPlayerPlaybackPort } from "../lib/queue-playback-port";

const libraryTrack = (state: TrackState): Track => ({
  kind: "library",
  id: "track-1" as Track["id"],
  title: "Test Track",
  artist: "Artist",
  artistIds: [],
  albumId: "album-1" as Track["albumId"],
  albumName: "Album",
  storagePath: "tracks/track-1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state,
  duration: 120,
  isLiked: false,
});

describe("player playback port", () => {
  it("reports a broken library track as not playable through the player port", () => {
    const port = createPlayerPlaybackPort();

    expect(port.checkPlayable(libraryTrack(TrackState.BROKEN))._unsafeUnwrapErr())
      .toEqual({ kind: "broken", trackId: "track-1" });
    expect(port.checkPlayable(libraryTrack(TrackState.READY)).isOk()).toBe(true);
  });
});
