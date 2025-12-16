import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";

export type ViewMode = "compact" | "list";

export interface ViewOption {
  value: ViewMode;
  label: string;
  icon: string;
}

export const viewOptions: ViewOption[] = [
  { value: "compact", label: "Компактный", icon: "tabler:menu-2" },
  { value: "list", label: "Список", icon: "tabler:list" },
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
