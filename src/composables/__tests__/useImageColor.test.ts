import { Hct, hexFromArgb } from "@material/material-color-utilities";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { paletteFromSeed } from "@/lib/color/material-palette";

// Mock the canvas sampler so orchestration is deterministic without a real
// canvas; quantization, scoring and the tonal palette run for real.
const { analyzeWithCanvas } = vi.hoisted(() => ({
  analyzeWithCanvas: vi.fn<(url: string) => Promise<number[] | null>>(),
}));

vi.mock("@/lib/color/canvas-analyzer", () => ({ analyzeWithCanvas }));

import { getColorFromImage, useImageColor } from "../useImageColor";

const hueDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const argbFromHex = (hex: string) => (0xff000000 | Number.parseInt(hex.slice(1), 16)) >>> 0;

const BLUE = 0xff1e5ac8;
const RED = 0xffc92f26;
const solid = (color: number, count = 500) => Array.from({ length: count }, () => color);

const BLUE_HEX = hexFromArgb(paletteFromSeed(BLUE).background);
const RED_HEX = hexFromArgb(paletteFromSeed(RED).background);

beforeEach(() => {
  analyzeWithCanvas.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getColorFromImage", () => {
  it("uses the tone-42 tonal background of the top seed as the result colour", async () => {
    analyzeWithCanvas.mockResolvedValue(solid(BLUE));

    const result = await getColorFromImage("blob:cover");

    expect(result.hex).toBe(BLUE_HEX);
    expect(hueDiff(Hct.fromInt(BLUE).hue, Hct.fromInt(argbFromHex(result.hex)).hue)).toBeLessThan(3);
    expect(Hct.fromInt(argbFromHex(result.hex)).tone).toBeCloseTo(42, 0);
    expect(result.rgb).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(result.hsl).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(result.isDark).toBe(true);
  });

  it("exposes the ranked seeds and the tonal roles of the top seed", async () => {
    analyzeWithCanvas.mockResolvedValue(solid(BLUE));

    const result = await getColorFromImage("blob:cover");
    const palette = paletteFromSeed(BLUE);

    expect(result.seeds).toEqual([hexFromArgb(BLUE)]);
    expect(result.palette).toEqual({
      accent: hexFromArgb(palette.accent),
      onAccent: hexFromArgb(palette.onAccent),
      text: hexFromArgb(palette.text),
      textMuted: hexFromArgb(palette.textMuted),
    });
  });

  it("returns the fallback colour when the sampler yields nothing", async () => {
    analyzeWithCanvas.mockResolvedValue(null);

    const result = await getColorFromImage("blob:cover");

    expect(result.hex).toBe("#535353");
    expect(result.seeds).toBeUndefined();
    expect(result.palette).toBeUndefined();
  });

  it("returns the fallback colour for a grey cover instead of an invented hue", async () => {
    analyzeWithCanvas.mockResolvedValue(solid(0xff808080));

    const result = await getColorFromImage("blob:cover");

    expect(result.hex).toBe("#535353");
  });

  it("honours a custom fallback colour", async () => {
    analyzeWithCanvas.mockResolvedValue(null);

    const result = await getColorFromImage("blob:cover", { fallback: "#123456" });

    expect(result.hex).toBe("#123456");
  });
});

describe("useImageColor", () => {
  it("starts with the fallback colour and idle state", () => {
    const { color, isLoading, error } = useImageColor();
    expect(color.value.hex).toBe("#535353");
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("toggles isLoading around extraction and stores the result", async () => {
    analyzeWithCanvas.mockResolvedValue(solid(BLUE));
    const { color, isLoading, extractColor } = useImageColor();

    const p = extractColor("blob:cover");
    expect(isLoading.value).toBe(true);
    await p;
    expect(isLoading.value).toBe(false);
    expect(color.value.hex).toBe(BLUE_HEX);
  });

  it("resetColor restores the fallback and clears error", async () => {
    analyzeWithCanvas.mockResolvedValue(solid(BLUE));
    const { color, error, extractColor, resetColor } = useImageColor();

    await extractColor("blob:cover");
    expect(color.value.hex).toBe(BLUE_HEX);

    resetColor();
    expect(color.value.hex).toBe("#535353");
    expect(error.value).toBeNull();
  });

  it("degrades to the fallback when extraction fails (no error surfaced)", async () => {
    analyzeWithCanvas.mockResolvedValue(null);
    const { color, error, extractColor } = useImageColor();

    await extractColor("blob:cover");

    expect(error.value).toBeNull();
    expect(color.value.hex).toBe("#535353");
  });

  // The request guard: when extractions overlap, the LAST requested cover wins
  // regardless of settle order, so a slow older cover can never clobber it.
  it("the newest requested cover wins even if an older one settles later", async () => {
    const resolvers: Array<(v: number[] | null) => void> = [];
    analyzeWithCanvas.mockImplementation(
      () => new Promise<number[] | null>((resolve) => {
        resolvers.push(resolve);
      }),
    );

    const { color, extractColor } = useImageColor();

    const first = extractColor("blob:old"); // requested first, resolves LAST
    const second = extractColor("blob:new"); // requested last, resolves FIRST

    resolvers[1](solid(RED)); // newer cover finishes first
    await second;
    expect(color.value.hex).toBe(RED_HEX);

    resolvers[0](solid(BLUE)); // older cover finishes later — must be ignored
    await first;
    expect(color.value.hex).toBe(RED_HEX);
  });
});
