import { describe, expect, it } from "vitest";
import { TrackSource } from "@/db/entities";
import { TrackId } from "../ids";
import {
  isRemoteTrackSource,
  ndTrackId,
  parseTrackRef,
  remoteIdOf,
  remoteTrackSource,
  ytTrackId,
} from "../track-ref";

describe("remoteIdOf", () => {
  it("returns the raw remote id behind an nd or yt ref", () => {
    expect(remoteIdOf(parseTrackRef(ndTrackId("s1")))).toBe("s1");
    expect(remoteIdOf(parseTrackRef(ytTrackId("dQw4w9WgXcQ")))).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a local ref", () => {
    expect(remoteIdOf(parseTrackRef(TrackId("3f2b8a1c-7d4e-4a09-9c1e-5b6d2f8e0a17")))).toBeNull();
  });
});

describe("remoteTrackSource", () => {
  it("maps every remote kind onto its persisted TrackSource", () => {
    expect(remoteTrackSource("nd")).toBe(TrackSource.REMOTE_SUBSONIC);
    expect(remoteTrackSource("yt")).toBe(TrackSource.REMOTE_YT);
  });

  it("tells persisted rows of a remote source from local and HLS ones", () => {
    expect(isRemoteTrackSource(TrackSource.REMOTE_SUBSONIC)).toBe(true);
    expect(isRemoteTrackSource(TrackSource.REMOTE_YT)).toBe(true);
    expect(isRemoteTrackSource(TrackSource.LOCAL_INTERNAL)).toBe(false);
    expect(isRemoteTrackSource(TrackSource.LOCAL_EXTERNAL)).toBe(false);
    expect(isRemoteTrackSource(TrackSource.REMOTE_HLS)).toBe(false);
  });
});
