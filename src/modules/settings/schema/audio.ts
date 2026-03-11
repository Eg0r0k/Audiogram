import { z } from "zod";

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export type EQFrequency = (typeof EQ_FREQUENCIES)[number];

export const EqualizerBandsSchema = z.tuple([
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
  z.number().min(-15).max(15),
]).default([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

export type EqualizerBands = z.infer<typeof EqualizerBandsSchema>;

export interface EQPreset {
  name: string;
  gains: number[];
  category: EQPresetCategory;
}

export const EQ_PRESET_CATEGORIES = {
  basic: "Basic",
  genre: "Genres",
  effect: "Effects",
  device: "Device",
} as const;

export type EQPresetCategory = keyof typeof EQ_PRESET_CATEGORIES;

export const EQ_PRESETS = {
  "Flat": { name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], category: "basic" },
  "Bass Boost": { name: "Bass Boost", gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0], category: "basic" },
  "Vocal Boost": { name: "Vocal Boost", gains: [-2, -2, -1, 0, 4, 5, 4, 2, 0, -1], category: "basic" },
  "Pop": { name: "Pop", gains: [-1, 1, 3, 4, 3, 1, -1, -1, 2, 2], category: "genre" },
  "Rock": { name: "Rock", gains: [5, 4, 2, 0, -1, -1, 0, 2, 4, 5], category: "genre" },
  "Hip-Hop": { name: "Hip-Hop", gains: [6, 5, 3, 1, -1, -1, 1, 2, 3, 3], category: "genre" },
  "Jazz": { name: "Jazz", gains: [3, 2, 1, 0, -1, -1, 0, 1, 2, 3], category: "genre" },
  "Classical": { name: "Classical", gains: [4, 3, 2, 1, 0, 0, 0, 1, 2, 3], category: "genre" },
  "Electronic": { name: "Electronic", gains: [5, 4, 2, 0, -2, -1, 0, 2, 4, 5], category: "genre" },
  "Acoustic": { name: "Acoustic", gains: [3, 2, 1, 0, 1, 1, 2, 2, 3, 2], category: "genre" },
  "Deep Bass": { name: "Deep Bass", gains: [8, 6, 3, 0, -2, -2, -1, 0, 0, 0], category: "effect" },
  "Bright": { name: "Bright", gains: [-2, -1, 0, 0, 1, 2, 3, 4, 5, 5], category: "effect" },
  "Crisp": { name: "Crisp", gains: [-1, 0, 0, 0, 0, 1, 2, 3, 4, 4], category: "effect" },
  "Live": { name: "Live", gains: [-2, 0, 2, 3, 3, 3, 2, 1, 2, 2], category: "effect" },
  "Headphones": { name: "Headphones", gains: [3, 4, 3, 1, -1, -1, 0, 2, 3, 4], category: "device" },
  "Small Speakers": { name: "Small Speakers", gains: [6, 5, 4, 2, 1, 0, 0, 1, 2, 2], category: "device" },
  "Laptop": { name: "Laptop", gains: [5, 4, 3, 1, 0, 0, 1, 2, 3, 3], category: "device" },
  "Car": { name: "Car", gains: [4, 3, 1, 0, -1, -1, 0, 2, 4, 5], category: "device" },
  "Earbuds": { name: "Earbuds", gains: [4, 3, 2, 1, 0, 0, 1, 2, 3, 3], category: "device" },
  "Podcast": { name: "Podcast", gains: [-3, -2, 0, 2, 4, 5, 4, 2, 0, -2], category: "device" },
} as const satisfies Record<string, EQPreset>;

export type EQPresetKey = keyof typeof EQ_PRESETS | "custom";

export const getPresetsByCategory = (category: EQPresetCategory): EQPreset[] => {
  return Object.values(EQ_PRESETS).filter(p => p.category === category);
};

export const FADE_DURATION_MIN = 0;
export const FADE_DURATION_MAX = 10;
export const FADE_DURATION_STEP = 0.1;
export const FADE_DURATION_DEFAULT = 1;

export const AudioSettingsSchema = z.object({
  equalizerEnabled: z.boolean().default(false),
  equalizerPreset: z.string().default("Flat"),
  equalizerBands: EqualizerBandsSchema,
  fadeEnabled: z.boolean().default(false),
  fadeInDuration: z.number().min(FADE_DURATION_MIN).max(FADE_DURATION_MAX).default(FADE_DURATION_DEFAULT),
  fadeOutDuration: z.number().min(FADE_DURATION_MIN).max(FADE_DURATION_MAX).default(FADE_DURATION_DEFAULT),
});

export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
export const DEFAULT_AUDIO_SETTINGS = AudioSettingsSchema.parse({});
