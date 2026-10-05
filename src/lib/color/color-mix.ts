import { clampChromaToGamut, hexToRgb, hslToRgb, oklchToHex, rgbToOklch, type RGB } from "./color";

const SUPPORTS_COLOR_MIX = typeof CSS !== "undefined" && CSS.supports("color", "color-mix(in oklch, red 50%, black)");
const HSL_PATTERN = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i;

/** `#rrggbb` or `hsl(h, s%, l%)` (the palette's format); null for anything else. */
export const parseCssRgb = (css: string): RGB | null => {
  const value = css.trim();
  if (/^#[a-f\d]{6}$/i.test(value)) return hexToRgb(value);
  const hsl = HSL_PATTERN.exec(value);
  return hsl ? hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100) : null;
};

/**
 * `color-mix(in oklch, <color> <keep>, black)`, or the same mix computed to
 * hex where color-mix() is unsupported (Android WebView < 111). Black has no
 * hue, so the mix scales lightness and chroma by `keep`.
 */
export const mixWithBlack = (color: string, keep: number, supported = SUPPORTS_COLOR_MIX): string => {
  if (supported) return `color-mix(in oklch, ${color} ${Math.round(keep * 100)}%, black)`;
  const rgb = parseCssRgb(color);
  if (!rgb) return color;
  const { L, C, h } = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const mixedL = L * keep;
  return oklchToHex(mixedL, clampChromaToGamut(mixedL, C * keep, h), h);
};
