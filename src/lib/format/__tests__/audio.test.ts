import { describe, expect, it } from "vitest";
import { formatBitrate, formatSampleRate } from "../audio";

describe("audio format", () => {
  it("formats bitrate in whole kbps", () => {
    expect(formatBitrate(320000)).toBe("320 kbps");
    expect(formatBitrate(127600)).toBe("128 kbps");
    expect(formatBitrate(0)).toBe("—");
    expect(formatBitrate(undefined)).toBe("—");
  });

  it("formats sample rate with one decimal of kHz", () => {
    expect(formatSampleRate(44100)).toBe("44.1 kHz");
    expect(formatSampleRate(48000)).toBe("48.0 kHz");
    expect(formatSampleRate(undefined)).toBe("—");
  });
});
