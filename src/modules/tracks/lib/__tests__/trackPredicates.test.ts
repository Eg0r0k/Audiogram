import { describe, expect, it } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import { ephemeralFilePath, ephemeralRemoteDto } from "../trackPredicates";

function libraryTrack(): Track {
  return {
    kind: "library",
    id: "t1" as Track["id"],
    title: "Library",
    artist: "Artist",
    artistIds: [],
    albumId: "a1" as Track["albumId"],
    albumName: "Album",
    storagePath: "tracks/t1.mp3",
    source: TrackSource.LOCAL_INTERNAL,
    state: TrackState.READY,
    duration: 100,
    isLiked: false,
  };
}

describe("ephemeralFilePath", () => {
  it("returns the absolute path of an open-with ephemeral track", () => {
    expect(ephemeralFilePath({
      kind: "ephemeral",
      id: "eph-1",
      title: "File",
      source: { type: "path", path: "C:/Music/track.flac" },
    })).toBe("C:/Music/track.flac");
  });

  it("returns null for a url-sourced ephemeral track", () => {
    expect(ephemeralFilePath({
      kind: "ephemeral",
      id: "eph-2",
      title: "Radio",
      source: { type: "url", url: "https://radio.example/stream" },
    })).toBeNull();
  });

  it("returns null for a library track and for null", () => {
    expect(ephemeralFilePath(libraryTrack())).toBeNull();
    expect(ephemeralFilePath(null)).toBeNull();
  });
});

// A stream entry has no library row, but downloading or pinning one must
// still land the full catalog identity (artist and album ids when the row
// carried them) — otherwise the copy sits in the library artist- and
// album-less, without a cover.
describe("ephemeralRemoteDto", () => {
  const BASE = "http://127.0.0.1:4321/tok";
  const COVER = "https://lh3.googleusercontent.com/cover=w226-h226";

  it("prefers the catalog DTO the stream was built from", () => {
    const sourceDto = { id: "yt:abc" as never, title: "Catalog", artistIds: ["yt:artist" as never], albumId: "yt:album" as never };

    expect(ephemeralRemoteDto({
      kind: "ephemeral",
      id: "e1",
      title: "Stream",
      source: { type: "url", url: `${BASE}/yt/abc` },
      sourceDto,
    })).toBe(sourceDto);
  });

  it("rebuilds the catalog track from a proxied YouTube stream and unwraps its proxied cover", () => {
    expect(ephemeralRemoteDto({
      kind: "ephemeral",
      id: "e1",
      title: "Stream",
      artist: "Someone",
      albumName: "Album",
      duration: 123,
      cover: `${BASE}/ytimg/${encodeURIComponent(COVER)}`,
      source: { type: "url", url: `${BASE}/yt/abc` },
    })).toEqual({
      id: "yt:abc",
      title: "Stream",
      artistName: "Someone",
      albumTitle: "Album",
      duration: 123,
      coverRef: COVER,
    });
  });

  // A restored ND stream has no cover: the queue restore drops the retired
  // loopback cover routes.
  it("keeps a plain https cover and rebuilds a cover-less ND stream", () => {
    const plain = ephemeralRemoteDto({
      kind: "ephemeral",
      id: "e1",
      title: "Stream",
      cover: COVER,
      source: { type: "url", url: `${BASE}/yt/abc` },
    });
    const ndStream = ephemeralRemoteDto({
      kind: "ephemeral",
      id: "e2",
      title: "Song",
      source: { type: "url", url: `${BASE}/nd/song/42` },
    });

    expect(plain?.coverRef).toBe(COVER);
    expect(ndStream).toMatchObject({ id: "nd:42", title: "Song" });
    expect(ndStream?.coverRef).toBeUndefined();
  });

  it("returns null for files and non-proxied streams", () => {
    expect(ephemeralRemoteDto({
      kind: "ephemeral",
      id: "e1",
      title: "File",
      source: { type: "path", path: "C:/Music/track.flac" },
    })).toBeNull();
    expect(ephemeralRemoteDto({
      kind: "ephemeral",
      id: "e2",
      title: "Radio",
      source: { type: "url", url: "https://radio.example/stream" },
    })).toBeNull();
  });
});
