import { describe, expect, it } from "vitest";
import type { BaseMetadata } from "@/workers/types";
import { ymTrackId } from "@/types/track-ref";
import { applyKnownMetadata } from "../known-metadata";

const parsed: BaseMetadata = {
  title: "Unknown Title",
  artists: [],
  album: "",
  duration: 213.4,
  format: { codec: "mp3", bitrate: 320000, sampleRate: 44100, lossless: false, channels: 2 },
  integratedLufs: -9.5,
};

describe("applyKnownMetadata", () => {
  it("takes identity fields from the source and keeps what only the file knows", () => {
    const merged = applyKnownMetadata(parsed, {
      sourceRef: ymTrackId("1"),
      title: "По глазам",
      artistName: "Artist A, Artist B",
      albumTitle: "ДЕФО",
      year: 2021,
      trackNo: 3,
      discNo: 1,
    });

    expect(merged).toMatchObject({
      title: "По глазам",
      artists: ["Artist A", "Artist B"],
      album: "ДЕФО",
      year: 2021,
      trackNo: 3,
      diskNo: 1,
      duration: 213.4,
      format: { codec: "mp3", bitrate: 320000 },
      integratedLufs: -9.5,
    });
  });

  it("falls back to the parsed tags for fields the source did not carry", () => {
    const merged = applyKnownMetadata(
      { ...parsed, artists: ["From Tags"], album: "Tag Album", year: 1999, pictureBlob: new Blob(["x"]) },
      { sourceRef: ymTrackId("1"), title: "  " },
    );

    expect(merged.title).toBe("Unknown Title");
    expect(merged.artists).toEqual(["From Tags"]);
    expect(merged.album).toBe("Tag Album");
    expect(merged.year).toBe(1999);
    expect(merged.pictureBlob).toBeInstanceOf(Blob);
  });

  it("a source cover replaces the embedded picture", () => {
    const cover = new Blob(["cover"], { type: "image/jpeg" });
    const merged = applyKnownMetadata(
      { ...parsed, pictureBlob: new Blob(["old"]) },
      { sourceRef: ymTrackId("1"), title: "T", cover },
    );

    expect(merged.pictureBlob).toBe(cover);
  });
});
