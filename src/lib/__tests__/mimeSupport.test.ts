import { describe, it, expect } from "vitest";
import {
  isValidAudioExtension,
  isValidAudioMimeType,
  isValidImageExtension,
  isValidImportItem,
} from "../environment/mimeSupport";

describe("mimeSupport", () => {
  describe("isValidAudioExtension", () => {
    it("returns true for valid audio extensions", () => {
      expect(isValidAudioExtension("mp3")).toBe(true);
      expect(isValidAudioExtension("flac")).toBe(true);
      expect(isValidAudioExtension("wav")).toBe(true);
      expect(isValidAudioExtension("ogg")).toBe(true);
      expect(isValidAudioExtension("m4a")).toBe(true);
      expect(isValidAudioExtension("aac")).toBe(true);
      expect(isValidAudioExtension("opus")).toBe(true);
      expect(isValidAudioExtension("webm")).toBe(true);
    });

    it("returns true for uppercase extensions", () => {
      expect(isValidAudioExtension("MP3")).toBe(true);
      expect(isValidAudioExtension("FLAC")).toBe(true);
      expect(isValidAudioExtension("Wav")).toBe(true);
    });

    it("returns false for invalid extensions", () => {
      expect(isValidAudioExtension("txt")).toBe(false);
      expect(isValidAudioExtension("jpg")).toBe(false);
      expect(isValidAudioExtension("pdf")).toBe(false);
      expect(isValidAudioExtension("doc")).toBe(false);
      expect(isValidAudioExtension("")).toBe(false);
      expect(isValidAudioExtension("exe")).toBe(false);
    });
  });

  describe("isValidAudioMimeType", () => {
    it("returns true for valid audio mime types", () => {
      expect(isValidAudioMimeType("audio/mpeg")).toBe(true);
      expect(isValidAudioMimeType("audio/flac")).toBe(true);
      expect(isValidAudioMimeType("audio/wav")).toBe(true);
      expect(isValidAudioMimeType("audio/ogg")).toBe(true);
      expect(isValidAudioMimeType("audio/mp4")).toBe(true);
    });

    it("returns true for mime types with additional parameters", () => {
      expect(isValidAudioMimeType("audio/mpeg; codecs=mp3")).toBe(true);
    });

    it("returns false for invalid mime types", () => {
      expect(isValidAudioMimeType("text/plain")).toBe(false);
      expect(isValidAudioMimeType("image/jpeg")).toBe(false);
      expect(isValidAudioMimeType("application/pdf")).toBe(false);
      expect(isValidAudioMimeType("")).toBe(false);
    });
  });

  describe("isValidImageExtension", () => {
    it("returns true for valid image extensions", () => {
      expect(isValidImageExtension("jpeg")).toBe(true);
      expect(isValidImageExtension("png")).toBe(true);
      expect(isValidImageExtension("gif")).toBe(true);
      expect(isValidImageExtension("webp")).toBe(true);
      expect(isValidImageExtension("svg")).toBe(true);
      expect(isValidImageExtension("avif")).toBe(true);
    });

    it("returns false for invalid extensions", () => {
      expect(isValidImageExtension("mp3")).toBe(false);
      expect(isValidImageExtension("txt")).toBe(false);
      expect(isValidImageExtension("pdf")).toBe(false);
    });
  });

  describe("isValidImportItem", () => {
    it("returns true for audio files by extension", () => {
      expect(isValidImportItem("song.mp3")).toBe(true);
      expect(isValidImportItem("track.flac")).toBe(true);
      expect(isValidImportItem("music.wav")).toBe(true);
      expect(isValidImportItem("audio.ogg")).toBe(true);
    });

    it("returns true for audio files by mime type", () => {
      expect(isValidImportItem("unknown", "audio/mpeg")).toBe(true);
      expect(isValidImportItem("file", "audio/flac")).toBe(true);
    });

    it("returns true when both extension and mime type are valid", () => {
      expect(isValidImportItem("song.mp3", "audio/mpeg")).toBe(true);
    });

    it("returns false for non-audio files", () => {
      expect(isValidImportItem("document.txt")).toBe(false);
      expect(isValidImportItem("image.jpg")).toBe(false);
      expect(isValidImportItem("video.mp4")).toBe(false);
      expect(isValidImportItem("archive.zip")).toBe(false);
      expect(isValidImportItem("file")).toBe(false);
      expect(isValidImportItem("")).toBe(false);
    });

    it("returns false for invalid mime types when extension is also invalid", () => {
      // If extension is invalid, returns false regardless of mime type
      expect(isValidImportItem("file.txt", "text/plain")).toBe(false);
      expect(isValidImportItem("file", "invalid/type")).toBe(false);
    });

    it("handles files with multiple dots in name", () => {
      expect(isValidImportItem("my.song.name.mp3")).toBe(true);
      expect(isValidImportItem("artist - title.flac")).toBe(true);
    });
  });
});