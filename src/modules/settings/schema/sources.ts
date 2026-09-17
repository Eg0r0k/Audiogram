import { boolean, object, optional, parse, string } from "valibot";
import type { InferOutput } from "valibot";
import type { NdConfig } from "@/modules/sources/navidrome/api/subsonic";

export const NdSourceSettingsSchema = object({
  enabled: optional(boolean(), false),
  baseUrl: optional(string(), ""),
  username: optional(string(), ""),
  password: optional(string(), ""),
});

export type NdSourceSettings = InferOutput<typeof NdSourceSettingsSchema>;

/** Only the switch: the sign-in itself lives on the Rust side, never in settings. */
export const YmSourceSettingsSchema = object({
  enabled: optional(boolean(), true),
});

export type YmSourceSettings = InferOutput<typeof YmSourceSettingsSchema>;

export const SourcesSettingsSchema = object({
  nd: optional(NdSourceSettingsSchema, parse(NdSourceSettingsSchema, {})),
  ym: optional(YmSourceSettingsSchema, parse(YmSourceSettingsSchema, {})),
});

export type SourcesSettings = InferOutput<typeof SourcesSettingsSchema>;

export const DEFAULT_SOURCES_SETTINGS = parse(SourcesSettingsSchema, {});

/**
 * Builds the config handed to the Subsonic client and the Rust proxy, or
 * `null` when the source is disabled or incomplete (nothing to talk to).
 */
export const buildNdConfig = (settings: NdSourceSettings): NdConfig | null => {
  if (!settings.enabled) return null;

  let baseUrl = settings.baseUrl.trim();
  while (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
  const username = settings.username.trim();
  if (!baseUrl || !username) return null;

  return { baseUrl, username, password: settings.password };
};
