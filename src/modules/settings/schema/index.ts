import { object, number, optional, parse } from "valibot";
import type { InferOutput } from "valibot";
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

export const SettingsSchema = object({
  version: optional(number(), 1),
  general: optional(GeneralSettingsSchema, DEFAULT_GENERAL_SETTINGS),
  playback: optional(PlaybackSettingsSchema, DEFAULT_PLAYBACK_SETTINGS),
  audio: optional(AudioSettingsSchema, DEFAULT_AUDIO_SETTINGS),
});

export type Settings = InferOutput<typeof SettingsSchema>;
export const DEFAULT_SETTINGS: Settings = parse(SettingsSchema, {});

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
