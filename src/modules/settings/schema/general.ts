import { z } from "zod";

export const SUPPORTED_LANGUAGES = ["system", "en", "ru"] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const BaseGeneralSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES).default("system"),
  checkUpdatesOnLaunch: z.boolean().default(true),
});

const TauriGeneralSchema = z.object({
  closeToTray: z.boolean().default(true),
  launchAtStartup: z.boolean().default(false),
  launchMinimized: z.boolean().default(false),
});

export const GeneralSettingsSchema = BaseGeneralSchema.merge(TauriGeneralSchema);

export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type BaseGeneralSettings = z.infer<typeof BaseGeneralSchema>;
export type TauriGeneralSettings = z.infer<typeof TauriGeneralSchema>;

export const DEFAULT_GENERAL_SETTINGS = GeneralSettingsSchema.parse({});

export const TAURI_ONLY_KEYS: (keyof TauriGeneralSettings)[] = [
  "closeToTray",
  "launchAtStartup",
  "launchMinimized",
];
