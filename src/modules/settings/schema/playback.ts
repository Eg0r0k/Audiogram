import { object, boolean, picklist, optional, parse } from "valibot";
import type { InferOutput } from "valibot";

export const PlaybackSettingsSchema = object({
  defaultRepeatMode: optional(picklist(["off", "all", "one"] as const), "off"),
  defaultShuffleEnabled: optional(boolean(), false),
});

export type PlaybackSettings = InferOutput<typeof PlaybackSettingsSchema>;
export const DEFAULT_PLAYBACK_SETTINGS = parse(PlaybackSettingsSchema, {});
