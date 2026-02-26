import { z } from "zod";
import { DEFAULT_GENERAL_SETTINGS, GeneralSettingsSchema, type GeneralSettings, type SupportedLanguage, SUPPORTED_LANGUAGES } from "./general";
import { DEFAULT_PLAYBACK_SETTINGS, PlaybackSettingsSchema, type PlaybackSettings } from "./playback";
import {
  AudioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettings,
  EQ_PRESETS,
  EQ_FREQUENCIES,
  EQ_PRESET_CATEGORIES,
  getPresetsByCategory,
  type EQPresetKey,
  type EqualizerBands,
} from "./audio";

export const SettingsSchema = z.object({
  version: z.number().default(1),
  general: GeneralSettingsSchema.default(DEFAULT_GENERAL_SETTINGS),
  playback: PlaybackSettingsSchema.default(DEFAULT_PLAYBACK_SETTINGS),
  audio: AudioSettingsSchema.default(DEFAULT_AUDIO_SETTINGS),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export {
  GeneralSettingsSchema,
  PlaybackSettingsSchema,
  AudioSettingsSchema,
  EQ_PRESETS,
  EQ_FREQUENCIES,
  SUPPORTED_LANGUAGES,
  EQ_PRESET_CATEGORIES,
  getPresetsByCategory,
  type EQPresetKey,
  type EqualizerBands,
  type GeneralSettings,
  type PlaybackSettings,
  type AudioSettings,
  type SupportedLanguage,
};
