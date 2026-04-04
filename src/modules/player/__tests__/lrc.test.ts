import { describe, expect, it } from "vitest";
import { findActiveLyricsIndex, parseLrc } from "../lib/lrc";

describe("parseLrc", () => {
  it("parses timestamps, repeated tags and offset", () => {
    const lines = parseLrc(`
[offset:500]
[00:01.00]Intro
[00:02.00][00:03.00]Line
    `);

    expect(lines).toEqual([
      { time: 1.5, text: "Intro" },
      { time: 2.5, text: "Line" },
      { time: 3.5, text: "Line" },
    ]);
  });
});

describe("findActiveLyricsIndex", () => {
  it("returns the last active line for current time", () => {
    const lines = [
      { time: 1, text: "One" },
      { time: 2.5, text: "Two" },
      { time: 4, text: "Three" },
    ];

    expect(findActiveLyricsIndex(lines, 0.5)).toBe(-1);
    expect(findActiveLyricsIndex(lines, 2.5)).toBe(1);
    expect(findActiveLyricsIndex(lines, 5)).toBe(2);
  });
});
