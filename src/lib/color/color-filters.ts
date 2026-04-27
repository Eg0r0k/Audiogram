import type { HSL } from "./color";

export function isBrownish(h: number, s: number, l: number): boolean {
  return h >= 10 && h <= 50 && s < 0.75 && l < 0.65;
}

export function isOlive(h: number, s: number, l: number): boolean {
  return h > 48 && h <= 95 && s < 0.65 && l < 0.70;
}

export function isMustardYellow(h: number, s: number, l: number): boolean {
  return h >= 55 && h <= 68 && s >= 0.35 && s <= 0.75 && l >= 0.42 && l <= 0.65;
}

export function isUrineYellow(h: number, s: number, l: number): boolean {
  return h >= 48 && h <= 62 && s >= 0.45 && s <= 0.85 && l >= 0.48 && l <= 0.68;
}

export function isDusty(_h: number, s: number, l: number): boolean {
  return s < 0.25 && l > 0.15 && l < 0.85;
}

export function isUglyBlueGray(h: number, s: number, l: number): boolean {
  return h >= 190 && h <= 240 && s < 0.25 && l < 0.48;
}

export function isSkinLike(h: number, s: number, l: number): boolean {
  return h >= 8 && h <= 32 && s >= 0.15 && s <= 0.60 && l >= 0.42 && l <= 0.85;
}

export function isNeonUgly(_h: number, s: number, l: number): boolean {
  return s > 0.85 && l > 0.68;
}

export function isWashedOut(_h: number, s: number, l: number): boolean {
  return s < 0.18 && l > 0.65 && l < 0.92;
}

export function isDirtyColor(hsl: HSL): boolean {
  const { h, s, l } = hsl;

  if (isBrownish(h, s, l)) return true;
  if (isOlive(h, s, l)) return true;
  if (isMustardYellow(h, s, l)) return true;
  if (isUrineYellow(h, s, l)) return true;
  if (isUglyBlueGray(h, s, l)) return true;
  if (isNeonUgly(h, s, l)) return true;
  if (isWashedOut(h, s, l)) return true;

  if (isDusty(h, s, l) && !(h >= 250 && h <= 330 && s > 0.20)) {
    return true;
  }

  return false;
}
