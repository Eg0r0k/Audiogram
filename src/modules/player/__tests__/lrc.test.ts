import { describe, expect, it } from "vitest";
import { buildLrc, findActiveLyricsIndex, formatLyricsTime, parseLrc, parseLyrics } from "../lib/lrc";

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

describe("parseLyrics", () => {
  it("parses a timestamped text as synced", () => {
    const parsed = parseLyrics("[00:01.00]Hello\r\n[00:02.00]\r\n[00:02.50]World");

    expect(parsed).toEqual({
      kind: "synced",
      lines: [
        { time: 1, text: "Hello" },
        { time: 2, text: "" },
        { time: 2.5, text: "World" },
      ],
    });
  });

  it("parses a text without timestamps as plain", () => {
    expect(parseLyrics("  Hello  \nWorld")).toEqual({ kind: "plain", lines: ["Hello", "World"] });
    expect(parseLyrics("")).toEqual({ kind: "plain", lines: [] });
    expect(parseLyrics("\n   \n")).toEqual({ kind: "plain", lines: [] });
  });

  it("drops untimed lines from a mixed text and keeps it synced", () => {
    const parsed = parseLyrics("Intro without time\n[00:01.00]One\nUntimed line\n[00:02.00]Two");

    expect(parsed).toEqual({
      kind: "synced",
      lines: [
        { time: 1, text: "One" },
        { time: 2, text: "Two" },
      ],
    });
  });

  it("keeps blank lines as verse separators in plain text, one per gap", () => {
    const parsed = parseLyrics("\n\nFirst\nSecond\n\n  \n\nThird\n\nFourth\n\n\n");

    expect(parsed).toEqual({ kind: "plain", lines: ["First", "Second", "", "Third", "", "Fourth"] });
  });

  it("applies the [offset:] tag to synced lines", () => {
    expect(parseLyrics("[offset:+500]\n[00:01.00]One\n[00:02.00]Two")).toEqual({
      kind: "synced",
      lines: [
        { time: 1.5, text: "One" },
        { time: 2.5, text: "Two" },
      ],
    });
    expect(parseLyrics("[offset:-1500]\n[00:01.00]One")).toEqual({
      kind: "synced",
      lines: [{ time: 0, text: "One" }],
    });
  });

  it("drops LRC ID tags but keeps bracketed section names in plain text", () => {
    const tags = "[ar:Artist]\n[ti:Title]\n[al:Album]\n[au:Author]\n[by:Someone]\n[offset:100]\n[re:Editor]\n[ve:1.0]\n[length:03:45]";

    expect(parseLyrics(`${tags}\n[Chorus]\nLa la\n\n[Verse 2]\nLa`)).toEqual({
      kind: "plain",
      lines: ["[Chorus]", "La la", "", "[Verse 2]", "La"],
    });
    expect(parseLyrics(`${tags}\n[00:01.00]One`)).toEqual({
      kind: "synced",
      lines: [{ time: 1.1, text: "One" }],
    });
  });
});

describe("buildLrc", () => {
  it("builds LRC from marks and keeps verse breaks", () => {
    const lrc = buildLrc(["First", "Second", "", "Third", "", ""], [1.234, 5.5, 61.076]);

    expect(lrc).toBe([
      "[00:01.23]First",
      "[00:05.50]Second",
      "[01:01.08]",
      "[01:01.08]Third",
    ].join("\n"));
  });

  it("round-trips marks through parseLyrics", () => {
    const marks = [0.5, 12.34, 12.34, 75.9];
    const parsed = parseLyrics(buildLrc(["One", "", "Two", "Three", "", "Four"], marks));

    expect(parsed.kind).toBe("synced");
    const lines = parsed.kind === "synced" ? parsed.lines : [];
    expect(lines.map(line => line.text)).toEqual(["One", "", "Two", "Three", "", "Four"]);
    expect(lines.filter(line => line.text !== "").map(line => line.time))
      .toEqual(marks.map(mark => expect.closeTo(mark, 2)));
    expect(findActiveLyricsIndex(lines, 12.35)).toBe(3);
    expect(findActiveLyricsIndex(lines, 76)).toBe(5);
  });

  it("formats a time as m:ss.s", () => {
    expect(formatLyricsTime(0)).toBe("0:00.0");
    expect(formatLyricsTime(41.24)).toBe("0:41.2");
    expect(formatLyricsTime(61.46)).toBe("1:01.5");
    expect(formatLyricsTime(59.96)).toBe("1:00.0");
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
