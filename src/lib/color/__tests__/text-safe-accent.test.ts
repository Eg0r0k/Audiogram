import { describe, expect, it } from "vitest";
import { ACCENT_COLOR_OPTIONS } from "@/modules/settings/accent-colors";
import { clampChromaToGamut, hexToRgb, oklchCssToHex, oklchToHex, rgbToOklch } from "../color";
import { textSafeAccent } from "../text-safe-accent";

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const whiteContrast = (hex: string) => 1.05 / (luminance(hex) + 0.05);

const channelDistance = (a: string, b: string) => {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return Math.max(Math.abs(left.r - right.r), Math.abs(left.g - right.g), Math.abs(left.b - right.b));
};

const oklchOf = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToOklch(r, g, b);
};

describe("textSafeAccent", () => {
  it("keeps white text at 4.5:1 or more for every accent option in light and dark", () => {
    const failing = ACCENT_COLOR_OPTIONS.flatMap(option => [
      { name: `${option.value} light`, css: option.light["--primary"] },
      { name: `${option.value} dark`, css: option.dark["--primary"] },
    ]).filter(({ css }) => whiteContrast(textSafeAccent(css) ?? "#ffffff") < 4.5);

    expect(failing).toEqual([]);
  });

  it("keeps white text at 4.5:1 or more for any custom colour", () => {
    const failing: string[] = [];
    for (let h = 0; h < 360; h += 5) {
      for (const C of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
        for (const L of [0.4, 0.6, 0.8, 0.95]) {
          const seed = oklchToHex(L, clampChromaToGamut(L, C, h), h);
          if (whiteContrast(textSafeAccent(seed) ?? "#ffffff") < 4.5) failing.push(seed);
        }
      }
    }

    expect(failing).toEqual([]);
  });

  it("darkens the default blue to about #0E77D1 in light and #7662CD in dark", () => {
    const blue = ACCENT_COLOR_OPTIONS.find(option => option.value === "blue")!;

    expect(channelDistance(textSafeAccent(blue.light["--primary"])!, "#0e77d1")).toBeLessThanOrEqual(6);
    expect(channelDistance(textSafeAccent(blue.dark["--primary"])!, "#7662cd")).toBeLessThanOrEqual(6);
  });

  it("keeps the hue and leaves an already dark accent as it is", () => {
    const red = ACCENT_COLOR_OPTIONS.find(option => option.value === "red")!.light["--primary"];
    const source = oklchOf(oklchCssToHex(red)!);
    const safe = oklchOf(textSafeAccent(red)!);

    expect(safe.h).toBeCloseTo(source.h, 0);
    expect(safe.L).toBeLessThanOrEqual(0.56 + 0.005);

    expect(channelDistance(textSafeAccent("#1a3a8a")!, "#1a3a8a")).toBeLessThanOrEqual(1);
  });

  it("reads hex and hsl and gives up on anything else", () => {
    expect(textSafeAccent("#8774e1")).toMatch(/^#[\da-f]{6}$/);
    expect(textSafeAccent("hsl(210, 80%, 60%)")).toMatch(/^#[\da-f]{6}$/);
    expect(textSafeAccent("var(--primary)")).toBeNull();
    expect(textSafeAccent("")).toBeNull();
  });
});
