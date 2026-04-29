import { describe, it, expect } from "vitest";
import { normalizeMetadata } from "../metadata";

describe("normalizeMetadata", () => {
  const mockFile = { name: "test.mp3", webkitRelativePath: "" } as File;

  it("returns original artists when present", () => {
    const raw = {
      title: "Test Song",
      artists: ["Artist1", "Artist2"],
      album: "Test Album",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw);

    expect(result.artists).toEqual(["Artist1", "Artist2"]);
    expect(result.album).toBe("Test Album");
  });

  it("returns empty artists array when no artists in metadata", () => {
    const raw = {
      title: "Test Song",
      artists: [],
      album: "Test Album",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw);

    expect(result.artists).toEqual([]);
  });

  it("filters out empty artists", () => {
    const raw = {
      title: "Test Song",
      artists: ["Artist1", "", "  ", "Artist2"],
      album: "Test Album",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw);

    expect(result.artists).toEqual(["Artist1", "Artist2"]);
  });

  it("returns empty album string when no album in metadata", () => {
    const raw = {
      title: "Test Song",
      artists: ["Artist1"],
      album: "",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw);

    expect(result.album).toBe("");
  });

  it("returns empty album string when album is Unknown", () => {
    const raw = {
      title: "Test Song",
      artists: ["Artist1"],
      album: "Unknown",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw);

    // sanitizeString returns null for "Unknown", so album becomes ""
    expect(result.album).toBe("");
  });

  it("preserves title when present", () => {
    const raw = {
      title: "My Song",
      artists: ["Artist1"],
      album: "Album",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw);

    expect(result.title).toBe("My Song");
  });

  it("defaults to Unknown Title when title is missing", () => {
    const raw = {
      title: null,
      artists: ["Artist1"],
      album: "Album",
      duration: 180,
    };

    const result = normalizeMetadata(mockFile, raw as any);

    expect(result.title).toBe("Unknown Title");
  });
});