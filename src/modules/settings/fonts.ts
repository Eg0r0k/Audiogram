export const FONT_IDS = ["system", "inter", "manrope", "onest"] as const;

export type FontId = (typeof FONT_IDS)[number];

export const DEFAULT_FONT_ID: FontId = "system";

export interface FontPreset {
  id: FontId;
  /** Family declared by the package's `@font-face`; null means no webfont. */
  family: string | null;
  /** Pulls in the `@font-face` rules on demand. */
  load: () => Promise<unknown>;
}

// Tailwind's own `--font-sans` default (theme.css), repeated here because
// overriding the variable replaces the whole stack, fallbacks included.
const FALLBACK_STACK
  = "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

export const FONT_PRESETS: readonly FontPreset[] = [
  {
    id: "system",
    family: null,
    load: () => Promise.resolve(),
  },
  {
    id: "inter",
    family: "Inter Variable",
    load: () => import("@fontsource-variable/inter/index.css"),
  },
  {
    id: "manrope",
    family: "Manrope Variable",
    load: () => import("@fontsource-variable/manrope/index.css"),
  },
  {
    id: "onest",
    family: "Onest Variable",
    load: () => import("@fontsource-variable/onest/index.css"),
  },
];

export const isFontId = (value: unknown): value is FontId =>
  FONT_IDS.includes(value as FontId);

const getPreset = (id: FontId): FontPreset | undefined =>
  FONT_PRESETS.find(preset => preset.id === id);

/**
 * Stack to write into `--font-sans`, or null when the Tailwind default should
 * stand — an unknown id degrades to null rather than to a broken family.
 */
export const resolveFontStack = (id: FontId): string | null => {
  const family = getPreset(id)?.family;
  if (!family) return null;
  return `'${family}', ${FALLBACK_STACK}`;
};

/** Stack for previewing `id` while some other font is the active one. */
export const fontPreviewStack = (id: FontId): string =>
  resolveFontStack(id) ?? FALLBACK_STACK;

export const loadFont = (id: FontId): Promise<unknown> =>
  getPreset(id)?.load() ?? Promise.resolve();
