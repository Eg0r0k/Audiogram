import { describe, expect, it } from "vitest";
import { TrackSource } from "@/db/entities";
import { TrackId } from "../ids";
import {
  isRemoteTrackSource,
  parseTrackRef,
  remoteIdOf,
  remoteTrackSource,
  ymAlbumId,
  ymArtistId,
  ymPlaylistId,
  ymTrackId,
} from "../track-ref";

describe("ym ids", () => {
  it("parses a ym track id into its numeric Yandex id", () => {
    expect(parseTrackRef(TrackId("ym:40144"))).toEqual({ kind: "ym", trackId: "40144" });
    expect(remoteIdOf(parseTrackRef(ymTrackId("40144")))).toBe("40144");
  });

  it("brands album, artist and playlist ids in the ym space", () => {
    expect(ymAlbumId("5307396")).toBe("ym:5307396");
    expect(ymArtistId("41075")).toBe("ym:41075");
    // A Yandex playlist is addressed by its owner and kind together.
    expect(ymPlaylistId(457553308, 41075)).toBe("ym:457553308:41075");
    expect(parseTrackRef(ymPlaylistId(457553308, 41075) as unknown as TrackId))
      .toEqual({ kind: "ym", trackId: "457553308:41075" });
  });

  it("persists ym rows under their own TrackSource", () => {
    expect(remoteTrackSource("ym")).toBe(TrackSource.REMOTE_YM);
    expect(isRemoteTrackSource(TrackSource.REMOTE_YM)).toBe(true);
  });
});
