import { describe, expect, it } from "vitest";
import { fileNameFromPath, stripExtension } from "../path";

describe("fileNameFromPath", () => {
  it("takes the last segment of a posix or windows path", () => {
    expect(fileNameFromPath("/music/album/song.mp3")).toBe("song.mp3");
    expect(fileNameFromPath("C:\\Music\\Album\\song.flac")).toBe("song.flac");
    expect(fileNameFromPath("C:\\Music/Album\\song.ogg")).toBe("song.ogg");
    expect(fileNameFromPath("song.wav")).toBe("song.wav");
    expect(fileNameFromPath("/music/album/")).toBe("");
    expect(fileNameFromPath("")).toBe("");
  });
});

describe("stripExtension", () => {
  it("strips only the last extension", () => {
    expect(stripExtension("song.mp3")).toBe("song");
    expect(stripExtension("live.2019.flac")).toBe("live.2019");
    expect(stripExtension("01. Intro.m4a")).toBe("01. Intro");
  });

  it("leaves a name without an extension alone", () => {
    expect(stripExtension("README")).toBe("README");
    expect(stripExtension("trailing.")).toBe("trailing.");
    expect(stripExtension("")).toBe("");
  });
});
