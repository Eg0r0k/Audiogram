export interface LyricsLine {
  time: number;
  text: string;
}

export type ParsedLyrics = { kind: "synced"; lines: LyricsLine[] } | { kind: "plain"; lines: string[] };

const TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_RE = /^\[offset:([+-]?\d+)\]$/i;
const ID_TAG_RE = /^\[(?:ar|ti|al|au|by|offset|re|ve|length):[^\]]*\]$/i;

function parseFraction(rawFraction: string | undefined): number {
  if (!rawFraction) return 0;

  if (rawFraction.length === 3) {
    return Number.parseInt(rawFraction, 10) / 1000;
  }

  if (rawFraction.length === 2) {
    return Number.parseInt(rawFraction, 10) / 100;
  }

  return Number.parseInt(rawFraction, 10) / 10;
}

export function parseLrc(input: string): LyricsLine[] {
  const lines = input.split(/\r?\n/);
  const parsed: LyricsLine[] = [];
  let offsetSeconds = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const offsetMatch = OFFSET_RE.exec(line);
    if (offsetMatch) {
      offsetSeconds = Number.parseInt(offsetMatch[1], 10) / 1000;
      continue;
    }

    const timestamps = [...line.matchAll(TIMESTAMP_RE)];
    if (timestamps.length === 0) continue;

    const text = line.replace(TIMESTAMP_RE, "").trim();

    for (const timestamp of timestamps) {
      const minutes = Number.parseInt(timestamp[1], 10);
      const seconds = Number.parseInt(timestamp[2], 10);
      const fraction = parseFraction(timestamp[3]);

      parsed.push({
        time: Math.max(0, minutes * 60 + seconds + fraction + offsetSeconds),
        text,
      });
    }
  }

  return parsed.sort((left, right) => left.time - right.time);
}

const parsePlainLines = (input: string): string[] => {
  const lines: string[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (ID_TAG_RE.test(line)) continue;
    if (!line && (lines.length === 0 || lines[lines.length - 1] === "")) continue;
    lines.push(line);
  }

  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
};

export const parseLyrics = (input: string): ParsedLyrics => {
  const synced = parseLrc(input);
  if (synced.length > 0) return { kind: "synced", lines: synced };
  return { kind: "plain", lines: parsePlainLines(input) };
};

const lrcTimestamp = (seconds: number): string => {
  const hundredths = Math.round(Math.max(0, seconds) * 100);
  const minutes = String(Math.floor(hundredths / 6000)).padStart(2, "0");
  const rest = String(Math.floor((hundredths % 6000) / 100)).padStart(2, "0");
  return `[${minutes}:${rest}.${String(hundredths % 100).padStart(2, "0")}]`;
};

// A blank verse break takes the next line's time, so it never becomes the active line.
export const buildLrc = (lines: readonly string[], marks: readonly number[]): string => {
  const output: string[] = [];
  let pendingBreaks = 0;
  let marked = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      pendingBreaks++;
      continue;
    }
    if (marked >= marks.length) break;
    const timestamp = lrcTimestamp(marks[marked++]);
    output.push(...Array<string>(pendingBreaks).fill(timestamp), `${timestamp}${line}`);
    pendingBreaks = 0;
  }

  return output.join("\n");
};

export const formatLyricsTime = (seconds: number): string => {
  const tenths = Math.round(Math.abs(seconds) * 10);
  const sign = seconds < 0 && tenths > 0 ? "-" : "";
  const rest = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  return `${sign}${Math.floor(tenths / 600)}:${rest}`;
};

export const hasLyricsText = (lyrics: ParsedLyrics): boolean =>
  lyrics.kind === "synced"
    ? lyrics.lines.some(line => line.text !== "")
    : lyrics.lines.some(line => line !== "");

export function findActiveLyricsIndex(lines: readonly LyricsLine[], currentTime: number): number {
  for (let index = lines.length - 1; index >= 0; index--) {
    if (currentTime >= lines[index].time) {
      return index;
    }
  }

  return -1;
}
