import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { provideDrawerMenuClose } from "@/components/ui/drawer-menu/context";
import { provideResponsiveMenu, type MenuPartSet, type ResponsiveMenuKind } from "./context";
import { sheetParts } from "./sets";

interface RootOptions {
  kind: ResponsiveMenuKind;
  popperParts: MenuPartSet;
  /** Controlled open state; `undefined` keeps the menu uncontrolled. */
  open: MaybeRefOrGetter<boolean | undefined>;
  onUpdateOpen: (open: boolean) => void;
}

/**
 * Shared root logic: the popper on desktop widths, a bottom sheet on mobile,
 * with one open state either way so consumers can stay uncontrolled.
 */
export const useResponsiveMenuRoot = (options: RootOptions) => {
  const { isMobileLayout } = useDeviceLayout();
  const mode = computed(() => (isMobileLayout.value ? "sheet" as const : "popper" as const));

  const internalOpen = ref(false);
  const isOpen = computed(() => toValue(options.open) ?? internalOpen.value);
  const setOpen = (open: boolean) => {
    internalOpen.value = open;
    options.onUpdateOpen(open);
  };

  const parts = computed(() => (mode.value === "sheet" ? sheetParts : options.popperParts));

  provideResponsiveMenu({ kind: options.kind, mode, parts, isOpen, setOpen });
  provideDrawerMenuClose(() => setOpen(false));

  return { mode, isOpen, setOpen };
};
