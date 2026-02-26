import { z } from "zod";

export const PlaybackSettingsSchema = z.object({
  defaultRepeatMode: z.enum(["off", "all", "one"]).default("off"),
  defaultShuffleEnabled: z.boolean().default(false),

});

export type PlaybackSettings = z.infer<typeof PlaybackSettingsSchema>;
export const DEFAULT_PLAYBACK_SETTINGS = PlaybackSettingsSchema.parse({});
