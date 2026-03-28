import { useLocalStorage } from "@vueuse/core";
import { computed, type Component } from "vue";

import IconMenu2 from "~icons/tabler/menu-2";
import IconList from "~icons/tabler/list";

export type ViewMode = "compact" | "list";

export interface ViewOption {
  value: ViewMode;
  label: string;
  icon: Component;
}

export const viewOptions: ViewOption[] = [
  { value: "compact", label: "media.display.compact", icon: IconMenu2 },
  { value: "list", label: "media.display.list", icon: IconList },
];

const VIEW_MODE_KEY = "library-view-mode" as const;

export const useLibraryView = () => {
  const viewMode = useLocalStorage<ViewMode>(VIEW_MODE_KEY, "list");

  const isCompact = computed(() => viewMode.value === "compact");

  const currentOption = computed(() => {
    return viewOptions.find(opt => opt.value === viewMode.value) ?? viewOptions[1];
  });

  return {
    viewMode,
    isCompact,
    currentOption,
    viewOptions,
  };
};
