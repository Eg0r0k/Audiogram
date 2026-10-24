import { describe, expect, it } from "vitest";
import { clampChromaToGamut, hexToRgb, oklchToHex, rgbToOklch } from "../color";
import { tintedSurface } from "../tinted-surface";

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

const seeds = (() => {
  const result = ["#000000", "#ffffff", "#808080", "#535353", "#d0d0d0"];
  for (let h = 0; h <= 350; h += 10) {
    for (const C of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
      for (const L of [0.3, 0.6, 0.85]) {
        result.push(oklchToHex(L, clampChromaToGamut(L, C, h), h));
      }
    }
  }
  return result;
})();

describe("tintedSurface", () => {
  it("keeps white text at 4.5:1 or more on every hue", () => {
    const failing = seeds.filter(seed => contrast("#ffffff", tintedSurface(seed).background) < 4.5);

    expect(failing).toEqual([]);
  });

  it("keeps the dimmed lines at 4.5:1 or more on every hue", () => {
    const failing = seeds.filter((seed) => {
      const { background, dim } = tintedSurface(seed);
      return contrast(dim, background) < 4.5;
    });

    expect(failing).toEqual([]);
  });

  it("caps chroma at 0.11", () => {
    const vivid = [
      oklchToHex(0.63, clampChromaToGamut(0.63, 0.3, 29), 29),
      oklchToHex(0.87, clampChromaToGamut(0.87, 0.3, 142), 142),
      oklchToHex(0.45, clampChromaToGamut(0.45, 0.3, 264), 264),
    ];

    for (const seed of vivid) {
      const { background } = tintedSurface(seed);
      const { r, g, b } = hexToRgb(background);
      const { L, C } = rgbToOklch(r, g, b);
      expect(C).toBeLessThanOrEqual(0.11 + 0.005);
      expect(C).toBeGreaterThan(0.08);
      expect(L).toBeCloseTo(0.42, 2);
    }
  });
});
