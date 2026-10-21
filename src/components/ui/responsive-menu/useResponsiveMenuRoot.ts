import { computed, nextTick, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { provideResponsiveMenu, type PopperMenuHandle, type ResponsiveMenuKind } from "./context";
import { popperParts, sheetParts } from "./sets";

interface RootOptions {
  kind: ResponsiveMenuKind;
  /** Controlled open state; `undefined` keeps the menu uncontrolled. */
  open: MaybeRefOrGetter<boolean | undefined>;
  modal: MaybeRefOrGetter<boolean>;
  onUpdateOpen: (open: boolean) => void;
}

/**
 * Shared root logic: the popper on desktop widths, a bottom sheet on mobile,
 * with one open state either way so consumers can stay uncontrolled.
 *
 * A popper context menu under a trigger opens itself at the pointer, so its
 * consumer can only close it: consumers set their own open flag from the
 * row's contextmenu handler, before the menu sees the event, and would
 * otherwise make Menu take the right-click for one on an already open menu.
 * Without a trigger nothing self-opens and the consumer calls `show`.
 */
export const useResponsiveMenuRoot = (options: RootOptions) => {
  const { isMobileLayout } = useDeviceLayout();
  const mode = computed(() => (isMobileLayout.value ? "sheet" as const : "popper" as const));
  const selfOpening = computed(() => options.kind === "context" && mode.value === "popper");

  const internalOpen = ref(false);
  const controlledOpen = computed(() => toValue(options.open));
  const isOpen = computed(() => (selfOpening.value ? internalOpen.value : controlledOpen.value ?? internalOpen.value));

  watch(controlledOpen, (open) => {
    if (open === false) internalOpen.value = false;
  });

  // A right-click elsewhere in the target hides the menu and reopens it on the
  // next tick; only a close that stays closed reaches the consumer.
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const setOpen = (open: boolean) => {
    internalOpen.value = open;
    clearTimeout(closeTimer);
    if (open || !selfOpening.value) {
      options.onUpdateOpen(open);
      return;
    }
    closeTimer = setTimeout(() => {
      if (!internalOpen.value) options.onUpdateOpen(false);
    });
  };

  const popper = shallowRef<PopperMenuHandle | null>(null);

  /**
   * Opens the menu for an event a row reported and takes the event: default
   * and propagation stop here, so neither the browser nor an enclosing menu
   * acts on it. An open popper is re-placed at the new event.
   */
  const show = (event?: Event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (mode.value === "sheet") {
      setOpen(true);
      return;
    }
    const surface = popper.value;
    if (!surface) return;
    if (!internalOpen.value) {
      surface.show(event);
      return;
    }
    // The anchor is read on open only, so a move is a close and a reopen.
    surface.hide();
    nextTick(() => surface.show(event)).catch(() => {});
  };

  const parts = computed(() => (mode.value === "sheet" ? sheetParts : popperParts));

  provideResponsiveMenu({
    kind: options.kind,
    mode,
    parts,
    isOpen,
    setOpen,
    modal: computed(() => toValue(options.modal)),
    trigger: shallowRef(null),
    triggerDisabled: shallowRef(false),
    popper,
  });

  return { mode, isOpen, setOpen, show };
};
