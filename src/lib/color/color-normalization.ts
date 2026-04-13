import { clamp, lerp } from "../math";
import { hslToHex, type HSL } from "./color";
import { getTargetLightness } from "./color-scoring";

export interface ColorNormalizationOptions {
  targetLightness: number;
}

export function normalizeColor(
  hsl: HSL,
  options: ColorNormalizationOptions,
): string {
  const { h, s, l } = hsl;
  let hFinal = h;
  let sFinal = s;

  if (h >= 20 && h <= 44 && s < 0.45) {
    hFinal = s < 0.30 ? 10 : 25;
    sFinal = Math.max(s, 0.50);
  }
  else if (h >= 45 && h <= 72) {
    if (s < 0.55 || l < 0.55) {
      hFinal = l < 0.50 ? 140 : 30;
      sFinal = Math.max(s, 0.52);
    }
    else {
      hFinal = 50;
      sFinal = clamp(s, 0.60, 0.75);
    }
  }
  else if (h >= 72 && h <= 100 && s < 0.45) {
    // Olives → clean green
    hFinal = 135;
    sFinal = Math.max(s, 0.48);
  }

  const targetL = getTargetLightness(hFinal, options.targetLightness);

  // Narrow saturation range
  const sFloor = 0.45;
  const sCeil = 0.72;
  const sNorm = clamp(
    lerp(sFinal, clamp(sFinal, sFloor, sCeil), 0.80),
    sFloor,
    sCeil,
  );

  // Lightness
  const lMix = clamp(l, 0.25, 0.75);
  const finalL = lerp(targetL, lMix, 0.15);

  return hslToHex(hFinal, sNorm, finalL);
}
