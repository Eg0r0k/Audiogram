import { clamp, lerp } from "../math";
import type { HSL, RGB } from "./color";
import { getChroma, getDistanceFromGray, rgbToHsl } from "./color";
import { isDirtyColor, isSkinLike } from "./color-filters";

export function getTargetLightness(h: number, baseL: number): number {
  if (h >= 45 && h <= 72) return Math.max(baseL, 0.58);
  if (h > 72 && h <= 100) return Math.max(baseL, 0.52);
  if (h >= 20 && h < 45) return Math.max(baseL, 0.48);
  if (h >= 190 && h <= 260) return Math.max(baseL, 0.44);
  if (h >= 300 || h <= 15) return Math.max(baseL, 0.46);
  if (h >= 100 && h <= 170) return Math.max(baseL, 0.45);
  return baseL;
}

export function getHuePreference(h: number, s: number): number {
  let score = 1;

  if (h >= 190 && h <= 260 && s > 0.30) score *= 1.35; // Blues
  if (h >= 300 || h <= 15) score *= 1.28; // Reds/purples
  if (h >= 265 && h <= 335 && s > 0.30) score *= 1.25; // Magenta/pink
  if (h >= 160 && h <= 190 && s > 0.32) score *= 1.20; // Cyan
  if (h >= 100 && h <= 160 && s > 0.35) score *= 1.15; // Emerald/teal

  // Moderate boost for oranges
  if (h >= 15 && h <= 40 && s > 0.50 && s < 0.85) score *= 1.08;

  // Heavy penalty for problematic zones
  if (h >= 45 && h <= 72) score *= 0.45; // Yellows
  if (h >= 72 && h <= 100) score *= 0.60; // Yellow-greens
  if (h >= 35 && h <= 50 && s < 0.60) score *= 0.35; // Dirty orange-browns

  return score;
}

export function getLightnessFitness(l: number): number {
  const center = 0.53;
  const distance = Math.abs(l - center);
  return clamp(1 - distance / 0.45, 0.15, 1);
}

export function getPixelWeight(x: number, y: number, size: number): number {
  const centerX = (size - 1) / 2;
  const centerY = (size - 1) / 2;

  const dx = (x - centerX) / centerX;
  const dy = (y - centerY) / centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return lerp(1.2, 0.72, clamp(distance, 0, 1));
}

export function scoreColor(
  rgb: RGB,
  count: number,
  centerWeight = 1,
): number {
  const { r, g, b } = rgb;
  const hsl = rgbToHsl(r, g, b);
  const { h, s, l } = hsl;

  const chroma = getChroma(r, g, b);
  const grayDistance = getDistanceFromGray(r, g, b);

  let score = 0;

  // Base metrics
  score += s * 0.36;
  score += chroma * 0.32;
  score += grayDistance * 0.22;
  score += getLightnessFitness(l) * 0.10;

  // Apply hue preferences
  score *= getHuePreference(h, s);

  // Boost saturated colors
  if (s > 0.58 && chroma > 0.45) {
    score *= 1.12;
  }

  // Penalize unsaturated
  if (s < 0.16 || chroma < 0.14) {
    score *= 0.35;
  }

  // Penalize extreme lightness
  if (l < 0.08 || l > 0.92) {
    score *= 0.15;
  }
  else if (l < 0.15 || l > 0.85) {
    score *= 0.50;
  }

  // Heavy penalty for dirty colors
  if (isDirtyColor(hsl)) {
    score *= 0.08;
  }

  // Penalty for skin-like colors
  if (isSkinLike(h, s, l)) {
    score *= 0.65;
  }

  // Moderate boost for popularity
  const countFactor = 1 + Math.log10(Math.max(count, 1)) * 0.08;
  score *= countFactor;
  score *= centerWeight;

  return score;
}

export function isUsefulColor(hsl: HSL, rgb: RGB): boolean {
  const { s, l } = hsl;
  const { r, g, b } = rgb;

  if (s < 0.10) return false;
  if (l < 0.05 || l > 0.95) return false;
  if (getDistanceFromGray(r, g, b) < 0.10) return false;
  if (isDirtyColor(hsl)) return false;

  return true;
}
