import { ref } from "vue";
import { Vibrant } from "node-vibrant/browser";
import type { Palette } from "node-vibrant/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ColorResult {
  hex: string;
  rgb: string;
  hsl: string;
  isDark: boolean;
}

export interface UseImageColorOptions {
  fallback?: string;
  targetLightness?: number;
}

const DEFAULT_OPTIONS = {
  fallback: "#535353",
  targetLightness: 0.42,
} satisfies Required<UseImageColorOptions>;

// ─────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }

    h /= 6;
  }

  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function buildResult(hex: string): ColorResult {
  const [r, g, b] = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  return {
    hex,
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
    isDark: l < 0.5,
  };
}

// ─────────────────────────────────────────────
// Colour quality heuristics
// ─────────────────────────────────────────────

function getChroma(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function distanceFromGray(r: number, g: number, b: number): number {
  const avg = (r + g + b) / 3;
  return (Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg)) / (255 * 1.5);
}

function isBrownish(h: number, s: number, l: number): boolean {
  return h >= 12 && h <= 48 && s < 0.72 && l < 0.62;
}

function isOlive(h: number, s: number, l: number): boolean {
  return h > 52 && h <= 90 && s < 0.42 && l < 0.58;
}

function isDusty(h: number, s: number, l: number): boolean {
  return s < 0.22 && l > 0.18 && l < 0.82;
}

function isUglyBlueGray(h: number, s: number, l: number): boolean {
  return h >= 190 && h <= 240 && s < 0.22 && l < 0.45;
}

function isTooSkinLike(h: number, s: number, l: number): boolean {
  return h >= 8 && h <= 28 && s >= 0.18 && s <= 0.55 && l >= 0.45 && l <= 0.82;
}

function isDirty(h: number, s: number, l: number): boolean {
  return (
    isBrownish(h, s, l)
    || isOlive(h, s, l)
    || isUglyBlueGray(h, s, l)
    || (isDusty(h, s, l) && !(h >= 250 && h <= 330 && s > 0.18))
  );
}

function isUsefulColor(h: number, s: number, l: number, r: number, g: number, b: number): boolean {
  if (s < 0.08) return false;
  if (l < 0.05 || l > 0.95) return false;
  if (distanceFromGray(r, g, b) < 0.08) return false;
  return true;
}

/**
 * Адаптивная целевая светлота.
 */
function getTargetLightness(h: number, baseL: number): number {
  if (h >= 40 && h <= 68) return Math.max(baseL, 0.50); // yellow
  if (h > 68 && h <= 100) return Math.max(baseL, 0.46); // yellow-green
  if (h >= 20 && h < 40) return Math.max(baseL, 0.45); // orange
  if (h >= 190 && h <= 260) return Math.max(baseL, 0.43); // blues can stay slightly deeper
  if (h >= 300 || h <= 15) return Math.max(baseL, 0.44); // red/magenta
  return baseL;
}

function getHuePreference(h: number, s: number): number {
  let score = 1;

  if (h >= 190 && h <= 255 && s > 0.28) score *= 1.22; // blue
  if (h >= 300 || h <= 12) score *= 1.16; // red / magenta-red
  if (h >= 285 && h <= 335 && s > 0.28) score *= 1.14; // magenta / pink
  if (h >= 105 && h <= 170 && s > 0.30) score *= 1.10; // emerald/teal
  if (h >= 25 && h <= 45 && s > 0.45) score *= 1.04; // orange, but restrained
  if (h >= 48 && h <= 75) score *= 0.92; // yellow/green-yellow slightly down
  if (h >= 76 && h <= 95) score *= 0.88; // olive-ish greens down

  return score;
}

function getLightnessFitness(l: number): number {
  // Best around ~0.45-0.58
  const center = 0.52;
  const distance = Math.abs(l - center);
  return clamp(1 - distance / 0.42, 0.2, 1);
}

function getPixelWeight(x: number, y: number, size: number): number {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  const dx = (x - cx) / cx;
  const dy = (y - cy) / cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // center gets more weight, edges less
  return lerp(1.2, 0.72, clamp(dist, 0, 1));
}

function scoreColor(
  r: number,
  g: number,
  b: number,
  count: number,
  centerWeight = 1,
): number {
  const { h, s, l } = rgbToHsl(r, g, b);
  const chroma = getChroma(r, g, b);
  const grayDistance = distanceFromGray(r, g, b);

  let score = 0;

  score += s * 0.34;
  score += chroma * 0.30;
  score += grayDistance * 0.20;
  score += getLightnessFitness(l) * 0.16;

  score *= getHuePreference(h, s);

  if (s > 0.55 && chroma > 0.42) {
    score *= 1.08;
  }

  if (s < 0.14 || chroma < 0.12) {
    score *= 0.45;
  }

  if (l < 0.10 || l > 0.90) {
    score *= 0.25;
  }
  else if (l < 0.16 || l > 0.84) {
    score *= 0.6;
  }

  if (isDirty(h, s, l)) {
    score *= 0.16;
  }

  if (isTooSkinLike(h, s, l)) {
    score *= 0.72;
  }

  const countFactor = 1 + Math.log10(Math.max(count, 1)) * 0.10;
  score *= countFactor;
  score *= centerWeight;

  return score;
}

const HUE_BUCKETS = 36;

interface ColorBucket {
  h: number;
  s: number;
  l: number;
  r: number;
  g: number;
  b: number;
  count: number;
  weightedCount: number;
  bestScore: number;
  hSum: number;
  sSum: number;
  lSum: number;
  centerWeightSum: number;
  bestH: number;
  bestS: number;
  bestL: number;
}

// ─────────────────────────────────────────────
// Canvas analysis
// ─────────────────────────────────────────────

async function analyzeWithCanvas(imageUrl: string): Promise<{ h: number; s: number; l: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      console.warn("[useImageColor] Canvas timeout");
      resolve(null);
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);

      try {
        const SIZE = 96;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          console.warn("[useImageColor] No canvas context");
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, SIZE, SIZE);

        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        const buckets: ColorBucket[] = Array.from({ length: HUE_BUCKETS }, () => ({
          h: 0,
          s: 0,
          l: 0,
          r: 0,
          g: 0,
          b: 0,
          count: 0,
          weightedCount: 0,
          bestScore: 0,
          hSum: 0,
          sSum: 0,
          lSum: 0,
          centerWeightSum: 0,
          bestH: 0,
          bestS: 0,
          bestL: 0,
        }));

        let usefulPixels = 0;
        let lightPixels = 0;
        let darkPixels = 0;
        let grayPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pixelIndex = i / 4;
          const x = pixelIndex % SIZE;
          const y = Math.floor(pixelIndex / SIZE);

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 16) continue;

          const { h, s, l } = rgbToHsl(r, g, b);

          if (l > 0.92) lightPixels++;
          if (l < 0.08) darkPixels++;
          if (s < 0.08) grayPixels++;

          if (!isUsefulColor(h, s, l, r, g, b)) continue;

          usefulPixels++;

          const bucketIdx = Math.floor((h / 360) * HUE_BUCKETS) % HUE_BUCKETS;
          const bucket = buckets[bucketIdx];
          const centerWeight = getPixelWeight(x, y, SIZE);

          bucket.count++;
          bucket.weightedCount += centerWeight;
          bucket.hSum += h * centerWeight;
          bucket.sSum += s * centerWeight;
          bucket.lSum += l * centerWeight;
          bucket.centerWeightSum += centerWeight;

          const pixelScore = scoreColor(r, g, b, 1, centerWeight);
          if (pixelScore > bucket.bestScore) {
            bucket.bestScore = pixelScore;
            bucket.bestH = h;
            bucket.bestS = s;
            bucket.bestL = l;
            bucket.h = h;
            bucket.s = s;
            bucket.l = l;
            bucket.r = r;
            bucket.g = g;
            bucket.b = b;
          }
        }

        const totalPixels = SIZE * SIZE;
        const lightRatio = lightPixels / totalPixels;
        const grayRatio = grayPixels / totalPixels;
        const usefulRatio = usefulPixels / totalPixels;

        // Fail only when image is mostly bright/empty and has almost no useful color
        if (lightRatio > 0.55 && usefulRatio < 0.08) {
          console.warn("[useImageColor] Mostly light/empty image, fallback");
          resolve(null);
          return;
        }

        if (grayRatio > 0.78 && usefulRatio < 0.06) {
          console.warn("[useImageColor] Mostly grayscale image, fallback");
          resolve(null);
          return;
        }

        if (usefulPixels < 70) {
          console.warn("[useImageColor] Not enough useful pixels, fallback");
          resolve(null);
          return;
        }

        for (const bucket of buckets) {
          if (bucket.count > 0 && bucket.centerWeightSum > 0) {
            bucket.h = bucket.hSum / bucket.centerWeightSum;
            bucket.s = bucket.sSum / bucket.centerWeightSum;
            bucket.l = bucket.lSum / bucket.centerWeightSum;
          }
        }

        // PASS 1: best accent
        const minAccentWeight = Math.max(4, usefulPixels * 0.0035);
        let bestAccent: ColorBucket | null = null;
        let bestAccentScore = 0;

        for (const bucket of buckets) {
          if (bucket.weightedCount < minAccentWeight) continue;
          if (isDirty(bucket.bestH, bucket.bestS, bucket.bestL)) continue;

          const score = scoreColor(
            bucket.r,
            bucket.g,
            bucket.b,
            bucket.count,
            clamp(bucket.weightedCount / Math.max(bucket.count, 1), 0.75, 1.25),
          );

          if (score > bestAccentScore) {
            bestAccentScore = score;
            bestAccent = bucket;
          }
        }

        if (bestAccent && bestAccentScore > 0.20) {
          resolve({
            h: bestAccent.bestH,
            s: bestAccent.bestS,
            l: bestAccent.bestL,
          });
          return;
        }

        // PASS 2: best dominant non-dirty bucket
        let bestDominant: ColorBucket | null = null;
        let bestDominantScore = 0;

        for (const bucket of buckets) {
          if (bucket.weightedCount < usefulPixels * 0.03) continue;
          if (isDirty(bucket.bestH, bucket.bestS, bucket.bestL)) continue;

          const dominance = bucket.weightedCount / usefulPixels;
          const score
            = scoreColor(bucket.r, bucket.g, bucket.b, bucket.count)
              * (0.85 + dominance * 0.8);

          if (score > bestDominantScore) {
            bestDominantScore = score;
            bestDominant = bucket;
          }
        }

        if (bestDominant) {
          resolve({
            h: bestDominant.bestH,
            s: bestDominant.bestS,
            l: bestDominant.bestL,
          });
          return;
        }

        // PASS 3: any acceptable bucket
        for (const bucket of buckets) {
          if (bucket.count < 10) continue;
          if (!isDirty(bucket.bestH, bucket.bestS, bucket.bestL) && bucket.bestS > 0.16) {
            resolve({
              h: bucket.bestH,
              s: bucket.bestS,
              l: bucket.bestL,
            });
            return;
          }
        }

        console.warn("[useImageColor] Canvas: all passes failed, returning null");
        resolve(null);
      }
      catch (e) {
        console.error("[useImageColor] Canvas error:", e);
        resolve(null);
      }
    };

    img.onerror = (e) => {
      clearTimeout(timeout);
      console.error("[useImageColor] Image load error:", e);
      resolve(null);
    };

    img.src = imageUrl;
  });
}

// ─────────────────────────────────────────────
// Vibrant fallback
// ─────────────────────────────────────────────

async function analyzeWithVibrant(imageUrl: string): Promise<{ h: number; s: number; l: number } | null> {
  try {
    const palette = await Vibrant.from(imageUrl).quality(1).getPalette();

    const swatches: Array<keyof Palette> = [
      "Vibrant",
      "LightVibrant",
      "DarkVibrant",
      "Muted",
      "LightMuted",
      "DarkMuted",
    ];

    let bestH = 0;
    let bestS = 0;
    let bestL = 0;
    let bestScore = 0;

    for (const key of swatches) {
      const swatch = palette[key];
      if (!swatch) continue;

      const [r, g, b] = hexToRgb(swatch.hex);
      const { h, s, l } = rgbToHsl(r, g, b);

      if (isDirty(h, s, l)) continue;
      if (!isUsefulColor(h, s, l, r, g, b)) continue;

      const score = scoreColor(r, g, b, swatch.population);

      if (score > bestScore) {
        bestScore = score;
        bestH = h;
        bestS = s;
        bestL = l;
      }
    }

    return bestScore > 0 ? { h: bestH, s: bestS, l: bestL } : null;
  }
  catch (e) {
    console.error("[useImageColor] Vibrant error:", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────

function normalise(h: number, s: number, l: number, opts: Required<UseImageColorOptions>): string {
  let hFinal = h;

  // Slight hue correction for ugly zones
  if (h >= 20 && h <= 40 && s < 0.42) {
    hFinal = 14;
  }
  else if (h >= 55 && h <= 85 && s < 0.34) {
    hFinal = 108;
  }

  const targetL = getTargetLightness(hFinal, opts.targetLightness);

  // preserve character more softly than hard clamping
  const sFloor = 0.42;
  const sCeil = 0.68;
  const sNorm = clamp(lerp(s, clamp(s, sFloor, sCeil), 0.72), sFloor, sCeil);

  // if source color was already very bright and pleasant, keep a bit more lightness
  const lMix = clamp(l, 0.22, 0.72);
  const finalL = lerp(targetL, lMix, 0.18);

  return hslToHex(hFinal, sNorm, finalL);
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export const getColorFromImage = async (
  imageUrl: string,
  options: UseImageColorOptions = {},
): Promise<ColorResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const canvasResult = await analyzeWithCanvas(imageUrl);
  if (canvasResult) {
    return buildResult(normalise(canvasResult.h, canvasResult.s, canvasResult.l, opts));
  }

  const vibrantResult = await analyzeWithVibrant(imageUrl);
  if (vibrantResult) {
    return buildResult(normalise(vibrantResult.h, vibrantResult.s, vibrantResult.l, opts));
  }

  console.warn("[useImageColor] All extraction methods failed, using fallback:", opts.fallback);
  return buildResult(opts.fallback);
};

export const useImageColor = (initialOptions: UseImageColorOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...initialOptions };
  const fallback = buildResult(opts.fallback);

  const color = ref<ColorResult>({ ...fallback });
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const extractColor = async (imageUrl: string, overrideOptions?: UseImageColorOptions) => {
    isLoading.value = true;
    error.value = null;

    try {
      color.value = await getColorFromImage(imageUrl, {
        ...opts,
        ...overrideOptions,
      });
    }
    catch (e) {
      error.value = e as Error;
      color.value = { ...fallback };
    }
    finally {
      isLoading.value = false;
    }
  };

  const resetColor = () => {
    color.value = { ...fallback };
    error.value = null;
  };

  return {
    color,
    isLoading,
    error,
    extractColor,
    resetColor,
  };
};
