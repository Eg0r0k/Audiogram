import {
  Hct,
  QuantizerCelebi,
  Score,
  TonalPalette,
} from "@material/material-color-utilities";

/** Neutral seed used when a cover has no usable colour (black-and-white art). */
export const FALLBACK_SEED = 0xff535353;

// Score always returns at least one colour and substitutes its own fallback
// (Google Blue) when every candidate is filtered out. A zero-alpha sentinel can
// never come out of the quantizer, so its presence means "nothing suitable".
const NO_SEED_SENTINEL = 0x00000000;

const DEFAULT_MAX_COLORS = 64;
const DESIRED_SEEDS = 4;

const BACKGROUND_TONE = 42;
const ACCENT_TONE = 80;
const ON_ACCENT_TONE = 20;
const TEXT_TONE = 95;
const TEXT_MUTED_TONE = 80;
// Hero gradients need punch: a lighter tone with a high chroma floor, for
// seeds that already carry a hue so a grey cover does not turn teal or
// mustard. The player background lifts a dull coloured seed to a lower floor,
// since its darker tone caps chroma earlier.
const VIVID_TONE = 50;
const VIVID_CHROMA_FLOOR = 64;
const BACKGROUND_CHROMA_FLOOR = 36;
const COLOURED_SEED_CHROMA = 16;

export interface PaletteFromSeedOptions {
  /** Scales the seed chroma used for the background palette (1 = as-is). */
  chromaMultiplier?: number;
}

export interface SeedPalette {
  seed: number;
  background: number;
  accent: number;
  onAccent: number;
  text: number;
  textMuted: number;
  vivid: number;
}

/** ARGB pixels → ranked theme seeds (ARGB). Empty when nothing is suitable. */
export const extractSeeds = (
  pixels: number[],
  maxColors: number = DEFAULT_MAX_COLORS,
): number[] => {
  if (pixels.length === 0) return [];
  const quantized = QuantizerCelebi.quantize(pixels, maxColors);
  const ranked = Score.score(quantized, {
    desired: DESIRED_SEEDS,
    filter: true,
    fallbackColorARGB: NO_SEED_SENTINEL,
  });
  return ranked.filter(color => color !== NO_SEED_SENTINEL);
};

export const paletteFromSeed = (
  seed: number,
  { chromaMultiplier = 1 }: PaletteFromSeedOptions = {},
): SeedPalette => {
  const { hue, chroma } = Hct.fromInt(seed);
  const primary = TonalPalette.fromHueAndChroma(hue, chroma);
  const isColoured = chroma >= COLOURED_SEED_CHROMA;
  const backgroundChroma = isColoured ? Math.max(chroma, BACKGROUND_CHROMA_FLOOR) : chroma;
  const background = TonalPalette.fromHueAndChroma(hue, backgroundChroma * chromaMultiplier);
  const text = TonalPalette.fromHueAndChroma(hue, Math.min(chroma / 12, 4));
  const textMuted = TonalPalette.fromHueAndChroma(hue, Math.min(chroma / 6, 8));
  const vividChroma = isColoured ? Math.max(chroma, VIVID_CHROMA_FLOOR) : chroma;
  const vivid = TonalPalette.fromHueAndChroma(hue, vividChroma);

  return {
    seed,
    background: background.tone(BACKGROUND_TONE),
    accent: primary.tone(ACCENT_TONE),
    onAccent: primary.tone(ON_ACCENT_TONE),
    text: text.tone(TEXT_TONE),
    textMuted: textMuted.tone(TEXT_MUTED_TONE),
    vivid: vivid.tone(VIVID_TONE),
  };
};
