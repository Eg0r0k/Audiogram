import { Hct } from "@material/material-color-utilities";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clampChromaToGamut,
  hexToRgb,
  oklchToHex,
  rgbToHsl,
  rgbToOklab,
  rgbToOklch,
} from "../color";
import { analyzeWithCanvas, imageDataToArgb } from "../canvas-analyzer";
import { extractSeeds, FALLBACK_SEED, paletteFromSeed } from "../material-palette";

const hueDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const argb = (r: number, g: number, b: number) =>
  ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;

/** `count` copies of each colour, interleaved so order carries no information. */
const pixelsOf = (...parts: Array<[color: number, count: number]>) => {
  const out: number[] = [];
  const total = parts.reduce((sum, [, n]) => sum + n, 0);
  for (let i = 0; i < total; i++) {
    for (const [color, count] of parts) {
      if (i < count) out.push(color);
    }
  }
  return out;
};

const ORANGE = argb(230, 120, 20);
const BLUE = argb(30, 90, 200);

describe("color math (color.ts)", () => {
  it("parses hex and reports achromatic conversions", () => {
    expect(hexToRgb("#535353")).toEqual({ r: 83, g: 83, b: 83 });
    expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 });
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
  });

  it("matches the published OKLab/OKLCH reference values", () => {
    const white = rgbToOklab(255, 255, 255);
    expect(white.L).toBeCloseTo(1, 4);
    expect(Math.hypot(white.a, white.b)).toBeLessThan(1e-4);

    const red = rgbToOklch(255, 0, 0);
    expect(red.L).toBeCloseTo(0.628, 3);
    expect(red.C).toBeCloseTo(0.258, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
  });

  it("round-trips colours through oklchToHex", () => {
    const blue = rgbToOklch(51, 102, 204);
    expect(oklchToHex(blue.L, blue.C, blue.h)).toBe("#3366cc");
  });

  it("trims an out-of-gamut chroma but leaves an in-gamut one", () => {
    const blue = rgbToOklch(51, 102, 204);
    expect(clampChromaToGamut(blue.L, blue.C, blue.h)).toBeCloseTo(blue.C, 5);
    expect(clampChromaToGamut(0.6, 0.4, 142)).toBeLessThan(0.4);
  });
});

describe("extractSeeds (Celebi quantization + Score)", () => {
  it("is deterministic for the same pixel array", () => {
    const pixels = pixelsOf([ORANGE, 700], [BLUE, 300]);
    expect(extractSeeds(pixels)).toEqual(extractSeeds([...pixels]));
  });

  it("ranks the dominant hue of a 70/30 two-colour image first", () => {
    const seeds = extractSeeds(pixelsOf([ORANGE, 700], [BLUE, 300]));
    expect(seeds.length).toBeGreaterThan(0);
    const first = Hct.fromInt(seeds[0]);
    const orangeHue = Hct.fromInt(ORANGE).hue;
    const blueHue = Hct.fromInt(BLUE).hue;
    expect(hueDiff(first.hue, orangeHue)).toBeLessThan(hueDiff(first.hue, blueHue));
  });

  it("returns at most four seeds", () => {
    const pixels = pixelsOf(
      [ORANGE, 200],
      [BLUE, 200],
      [argb(40, 180, 80), 200],
      [argb(200, 40, 160), 200],
      [argb(240, 220, 40), 200],
      [argb(40, 200, 220), 200],
    );
    expect(extractSeeds(pixels).length).toBeLessThanOrEqual(4);
  });

  // A black-and-white cover must not yield Google Blue or any invented hue.
  it("returns nothing for grey pixels and the fallback seed is neutral", () => {
    const greys: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const g = (i * 37) % 256;
      greys.push(argb(g, g, g));
    }
    expect(extractSeeds(greys)).toEqual([]);
    expect(FALLBACK_SEED).toBe(0xff535353);
    expect(() => paletteFromSeed(FALLBACK_SEED)).not.toThrow();
    expect(Hct.fromInt(paletteFromSeed(FALLBACK_SEED).background).chroma).toBeLessThan(5);
  });

  it("returns nothing for an empty pixel array", () => {
    expect(extractSeeds([])).toEqual([]);
  });
});

describe("paletteFromSeed (tonal roles)", () => {
  const PURPLE = 0xff7985e1;

  it("keeps the seed hue and lands the background on tone 42", () => {
    const palette = paletteFromSeed(PURPLE);
    const seed = Hct.fromInt(PURPLE);
    const bg = Hct.fromInt(palette.background);
    expect(palette.seed).toBe(PURPLE);
    expect(hueDiff(bg.hue, seed.hue)).toBeLessThan(3);
    expect(bg.tone).toBeCloseTo(42, 0);
  });

  it("places accent, onAccent, text and textMuted on their tones", () => {
    const palette = paletteFromSeed(PURPLE);
    expect(Hct.fromInt(palette.accent).tone).toBeCloseTo(80, 0);
    expect(Hct.fromInt(palette.onAccent).tone).toBeCloseTo(20, 0);
    expect(Hct.fromInt(palette.text).tone).toBeCloseTo(95, 0);
    expect(Hct.fromInt(palette.textMuted).tone).toBeCloseTo(80, 0);
    expect(Hct.fromInt(palette.text).chroma).toBeLessThan(Hct.fromInt(palette.accent).chroma);
  });

  it("scales background chroma by chromaMultiplier", () => {
    const full = Hct.fromInt(paletteFromSeed(PURPLE, { chromaMultiplier: 1 }).background);
    const muted = Hct.fromInt(paletteFromSeed(PURPLE, { chromaMultiplier: 0.33 }).background);
    expect(muted.chroma).toBeLessThan(full.chroma);
    expect(hueDiff(muted.hue, full.hue)).toBeLessThan(3);
  });
});

describe("imageDataToArgb", () => {
  it("packs opaque RGBA pixels into ARGB and skips translucent ones", () => {
    const data = new Uint8ClampedArray([
      230, 120, 20, 255,
      30, 90, 200, 128,
      0, 0, 0, 127,
      10, 20, 30, 0,
    ]);
    expect(imageDataToArgb(data)).toEqual([ORANGE, BLUE]);
  });
});

describe("analyzeWithCanvas request mode", () => {
  // A CORS-mode load gets its own memory-cache entry, so a plain <img> of the
  // same URL mounted later refetches and flashes blank for a frame.
  const created: HTMLImageElement[] = [];
  const RealImage = globalThis.Image;

  const stubImage = () => {
    created.length = 0;
    vi.stubGlobal("Image", class {
      crossOrigin: string | null = null;
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      remove() {}
      set src(_value: string) {
        created.push(this as unknown as HTMLImageElement);
        queueMicrotask(() => this.onerror?.(new Event("error")));
      }
    });
  };

  afterEach(() => {
    vi.stubGlobal("Image", RealImage);
    vi.restoreAllMocks();
  });

  const loadWith = async (url: string) => {
    stubImage();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await analyzeWithCanvas(url);
    expect(result).toBeNull();
    return created[0]?.crossOrigin ?? null;
  };

  it("loads same-origin paths without CORS", async () => {
    expect(await loadWith("/img/liked-fallback.svg")).toBeNull();
  });

  it("loads blob and data URLs without CORS", async () => {
    expect(await loadWith("blob:http://localhost/abc")).toBeNull();
    expect(await loadWith("data:image/png;base64,AAAA")).toBeNull();
  });

  it("loads cross-origin URLs anonymously", async () => {
    expect(await loadWith("http://127.0.0.1:5555/cover/1")).toBe("anonymous");
  });
});
