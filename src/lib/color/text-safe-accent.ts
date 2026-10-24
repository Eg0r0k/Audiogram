import { clampChromaToGamut, hexToRgb, oklchCssToHex, oklchToHex, rgbToOklch } from "./color";
import { parseCssRgb } from "./color-mix";

const MAX_LIGHTNESS = 0.56;
const MIN_WHITE_CONTRAST = 4.5;

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const whiteContrast = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return 1.05 / (0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) + 0.05);
};

export const textSafeAccent = (css: string): string | null => {
  const rgb = parseCssRgb(oklchCssToHex(css) ?? css);
  if (!rgb) return null;

  const { L, C, h } = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const toHex = (lightness: number) => oklchToHex(lightness, clampChromaToGamut(lightness, C, h), h);
  const capped = toHex(Math.min(L, MAX_LIGHTNESS));
  if (whiteContrast(capped) >= MIN_WHITE_CONTRAST) return capped;

  // Greens and teals are brighter than their OKLCH lightness suggests and still fail at the cap.
  let low = 0;
  let high = Math.min(L, MAX_LIGHTNESS);
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    if (whiteContrast(toHex(mid)) >= MIN_WHITE_CONTRAST) low = mid;
    else high = mid;
  }
  return toHex(low);
};
