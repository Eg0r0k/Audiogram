import { ref, watch } from "vue";
import { getAccentColorOption } from "../accent-colors";
import { AccentColor } from "../schema/appearance";

const accentColor = ref<AccentColor>(
  (localStorage.getItem("accent-color") as AccentColor) || "blue",
);

let initialized = false;

function applyAccentColor(color: AccentColor, isDark: boolean) {
  const option = getAccentColorOption(color);
  const vars = isDark ? option.dark : option.light;
  const root = document.documentElement;

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function useAccentColor() {
  if (!initialized) {
    applyAccentColor(accentColor.value, isDarkMode());
    initialized = true;

    const observer = new MutationObserver(() => {
      applyAccentColor(accentColor.value, isDarkMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  watch(accentColor, (newColor) => {
    applyAccentColor(newColor, isDarkMode());
  });

  function setAccentColor(color: AccentColor) {
    accentColor.value = color;
    localStorage.setItem("accent-color", color);
  }

  return {
    accentColor,
    setAccentColor,
  };
}
