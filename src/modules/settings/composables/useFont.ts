import { readonly, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { getLogger } from "@/lib/logger";
import type { FontId } from "../fonts";
import {
  DEFAULT_FONT_ID,
  FONT_PRESETS,
  isFontId,
  loadFont,
  resolveFontStack,
} from "../fonts";

const font = useStorage<FontId>("app-font", DEFAULT_FONT_ID);

/**
 * Tailwind compiles `--default-font-family` down to `var(--font-sans)`, and
 * preflight hands that to `html` — so this one variable moves both the
 * document font and every `font-sans` utility. `--font-mono` stays untouched,
 * which keeps `<code>` monospaced.
 */
const applyFont = (id: FontId): void => {
  const stack = resolveFontStack(id);
  const root = document.documentElement;

  if (stack === null) {
    root.style.removeProperty("--font-sans");
    return;
  }

  root.style.setProperty("--font-sans", stack);
};

const requestFont = (id: FontId): void => {
  applyFont(id);
  loadFont(id).catch(err =>
    getLogger().error(`[Font] failed to load "${id}": ${String(err)}`),
  );
};

// Single module-level watcher: useFont() is called from more than one screen,
// per-call watchers would re-apply the font once per caller.
watch(font, requestFont);

let initialized = false;

/** Applies the persisted font once at startup; called from main.ts. */
export const initFont = (): void => {
  if (initialized) return;
  initialized = true;

  // A renamed or hand-edited preset id would otherwise leave the radio group
  // with nothing selected.
  if (!isFontId(font.value)) font.value = DEFAULT_FONT_ID;

  requestFont(font.value);
};

/**
 * Previews in the picker render in their own family, which needs every
 * `@font-face` present — not just the selected one.
 */
export const preloadAllFonts = (): void => {
  for (const preset of FONT_PRESETS) {
    preset.load().catch(err =>
      getLogger().error(`[Font] failed to preload "${preset.id}": ${String(err)}`),
    );
  }
};

export const useFont = () => {
  initFont();

  return {
    font: readonly(font),
    fonts: FONT_PRESETS,
    setFont: (id: FontId) => {
      font.value = id;
    },
    preloadAllFonts,
  };
};
