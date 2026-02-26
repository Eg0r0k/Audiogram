import { z } from "zod";

export const ACCENT_COLORS = [
  "blue",
  "purple",
  "pink",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const AppearanceSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  accentColor: z.enum(ACCENT_COLORS).default("blue"),
});

export type AppearanceSettings = z.infer<typeof AppearanceSettingsSchema>;
