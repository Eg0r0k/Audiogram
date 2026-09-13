import { useTheme } from "../composables/useTheme";
import { useAccentColor } from "../composables/useAccentColor";
import { CONTRAST_MODES, useContrast } from "../composables/useContrast";
import { ACCENT_COLOR_OPTIONS } from "../accent-colors";

export type Theme = "system" | "light" | "dark";

export interface ThemeOption {
  value: Theme;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
];

export function useAppearanceSettings() {
  const { mode, resolvedTheme, isDark, changeTheme, toggleTheme } = useTheme();
  const { accentColor, customAccentColor, setAccentColor, setCustomAccentColor } = useAccentColor();
  const { mode: contrast, isHighContrast, changeContrast } = useContrast();

  return {
    contrast,
    isHighContrast,
    contrastModes: CONTRAST_MODES,
    setContrast: changeContrast,

    theme: mode,
    activeTheme: resolvedTheme,
    isDark,
    themes: THEME_OPTIONS,
    setTheme: changeTheme,
    toggleTheme,

    accentColor,
    customAccentColor,
    accentColors: ACCENT_COLOR_OPTIONS,
    setAccentColor,
    setCustomAccentColor,
  };
}
