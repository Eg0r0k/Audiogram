import { computed, readonly, watch } from "vue";
import { usePreferredContrast, useStorage } from "@vueuse/core";

export type ContrastMode = "system" | "off" | "on";

export const CONTRAST_MODES: readonly ContrastMode[] = ["system", "off", "on"];

// Only "more" asks for contrast; "custom" means forced colors, which the
// browser applies on its own.
export const resolveContrast = (mode: ContrastMode, preferred: string): boolean => {
  if (mode === "system") return preferred === "more";
  return mode === "on";
};

const mode = useStorage<ContrastMode>("contrast-mode", "system");
const preferred = usePreferredContrast();
const isHighContrast = computed(() => resolveContrast(mode.value, preferred.value));

export const useContrast = () => ({
  mode: readonly(mode),
  isHighContrast,
  changeContrast: (next: ContrastMode) => {
    mode.value = next;
  },
});

watch(isHighContrast, (on) => {
  document.documentElement.classList.toggle("contrast", on);
}, { immediate: true });
