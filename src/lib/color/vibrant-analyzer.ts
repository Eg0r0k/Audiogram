import { Swatch, Vibrant } from "node-vibrant/browser";
import { hexToRgb, HSL, rgbToHsl } from "./color";
import { isUsefulColor, scoreColor } from "./color-scoring";
import { isDirtyColor } from "./color-filters";
const PALETTE_KEYS = [
  "Vibrant",
  "LightVibrant",
  "DarkVibrant",
  "Muted",
  "LightMuted",
  "DarkMuted",
] as const;

export async function analyzeWithVibrant(imageUrl: string): Promise<HSL | null> {
  try {
    const palette = await Vibrant.from(imageUrl).quality(1).getPalette();

    let bestHsl: HSL | null = null;
    let bestScore = 0;

    for (const key of PALETTE_KEYS) {
      const swatch = palette[key] as Swatch | null;
      if (!swatch) continue;

      const rgb = hexToRgb(swatch.hex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

      if (isDirtyColor(hsl)) continue;
      if (!isUsefulColor(hsl, rgb)) continue;

      const score = scoreColor(rgb, swatch.population);

      if (score > bestScore) {
        bestScore = score;
        bestHsl = hsl;
      }
    }

    return bestScore > 0 ? bestHsl : null;
  }
  catch (error) {
    console.error("[ColorExtraction] Vibrant error:", error);
    return null;
  }
}
