import { clampChromaToGamut, hexToRgb, oklchToHex, rgbToOklch } from "./color";

const SURFACE_LIGHTNESS = 0.42;
const MAX_SURFACE_CHROMA = 0.11;
const DIM_WHITE_SHARE = 0.72;

export const tintedSurface = (hex: string): { background: string; dim: string } => {
  const { r, g, b } = hexToRgb(hex);
  const { C, h } = rgbToOklch(r, g, b);
  const chroma = clampChromaToGamut(SURFACE_LIGHTNESS, Math.min(C, MAX_SURFACE_CHROMA), h);
  const dimLightness = DIM_WHITE_SHARE + (1 - DIM_WHITE_SHARE) * SURFACE_LIGHTNESS;
  const dimChroma = (1 - DIM_WHITE_SHARE) * chroma;
  return {
    background: oklchToHex(SURFACE_LIGHTNESS, chroma, h),
    dim: oklchToHex(dimLightness, clampChromaToGamut(dimLightness, dimChroma, h), h),
  };
};
