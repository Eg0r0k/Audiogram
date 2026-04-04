import { object, picklist, optional } from "valibot";
import type { InferOutput as InferOut } from "valibot";

export const ACCENT_COLORS = [
  "blue",
  "pink",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const AppearanceSettingsSchema = object({
  theme: optional(picklist(["light", "dark", "system"] as const), "system"),
  accentColor: optional(picklist(ACCENT_COLORS), "blue"),
});

export type AppearanceSettings = InferOut<typeof AppearanceSettingsSchema>;
