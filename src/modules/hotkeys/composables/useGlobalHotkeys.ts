import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { computed, ref, watch } from "vue";
import { useActiveElement, useMagicKeys, whenever } from "@vueuse/core";
import { VOLUME_REPEAT_MS, VOLUME_STEP } from "../constants";
import { useHoldRepeat } from "./useHoldRepeat";
import { useSeekHold } from "./useSeekHold";
import { clamp } from "@/lib/math";
import { useSearch } from "@/modules/search/composables/useSearch";
import { useSidebar } from "@/composables/useSidebar";
import { SIDEBAR_COMPACT_WIDTH, SIDEBAR_EXPANDED_MIN_WIDTH } from "@/components/layout/sidebar/sidebarCompact";

const EDITABLE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
const PREVENT_DEFAULT_KEYS = new Set([" ", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "f", "F"]);

export const useGlobalHotKeys = () => {
  const player = usePlayerStore();
  const queue = useQueueStore();
  const rightPanel = useRightPanelStore();
  const isEnabled = ref(true);
  const { openSearch, isSearchOpen } = useSearch();
  const { leftSidebar, expandLeftSidebar, setLeftSidebarWidth } = useSidebar();

  let restoreCompactOnClose = false;

  watch(isSearchOpen, (open) => {
    if (open || !restoreCompactOnClose) return;
    restoreCompactOnClose = false;
    setLeftSidebarWidth(SIDEBAR_COMPACT_WIDTH);
  });

  const activeElement = useActiveElement();

  const canFire = computed(() => {
    if (!isEnabled.value) return false;
    const el = activeElement.value;
    if (!el) return true;
    if (EDITABLE_TAGS.has(el.tagName)) return false;
    if (el instanceof HTMLElement && el.isContentEditable) return false;
    return true;
  });

  const keys = useMagicKeys(
    {
      passive: false,
      onEventFired(e) {
        if (e.type !== "keydown" || !canFire.value) return;
        const isArrowKey = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key);
        if (isArrowKey && e.altKey) return;

        if (PREVENT_DEFAULT_KEYS.has(e.key)) {
          e.preventDefault();
        }
      },
    },
  );

  whenever(() => keys.space.value && canFire.value, () => player.togglePlay());
  whenever(() => keys.MediaPlayPause.value && isEnabled.value, () => player.togglePlay());
  whenever(() => keys.MediaStop.value && isEnabled.value, () => player.stop());
  whenever(() => keys.MediaTrackNext.value && isEnabled.value, () => queue.next());
  whenever(() => keys.MediaTrackPrevious.value && isEnabled.value, () => queue.previous());

  whenever(
    () => (keys["ctrl+arrowright"].value || keys["meta+arrowright"].value) && canFire.value,
    () => queue.next(),
  );
  whenever(
    () => (keys["ctrl+arrowleft"].value || keys["meta+arrowleft"].value) && canFire.value,
    () => queue.previous(),
  );

  useSeekHold(1, () => keys["shift+arrowright"].value && canFire.value);
  useSeekHold(-1, () => keys["shift+arrowleft"].value && canFire.value);

  // Volume, in whole percents: repeated float steps drift (0.1 + 0.05 is
  // 0.15000000000000002).
  const volumeStep = (direction: 1 | -1) => () => () => {
    const next = Math.round(clamp(player.volume + direction * VOLUME_STEP, 0, 1) * 100) / 100;
    if (next === player.volume) return false;
    player.setVolume(next);
    return next > 0 && next < 1;
  };
  useHoldRepeat(() => keys.arrowup.value && canFire.value, VOLUME_REPEAT_MS, volumeStep(1));
  useHoldRepeat(() => keys.arrowdown.value && canFire.value, VOLUME_REPEAT_MS, volumeStep(-1));

  // A Ctrl, Meta or Alt chord is the browser's or the OS's (Ctrl+R reloads,
  // Ctrl+S saves). useMagicKeys reports the letter as down either way, and a
  // toggle fired on Ctrl+R was flushed to storage on pagehide and came back
  // flipped after the reload. The modifier refs are taken up front: the
  // proxy only tracks a key once its ref exists, and a lazy read from inside
  // `chord` would miss the modifier that was pressed before it.
  const modifiers = [keys.control, keys.meta, keys.alt];
  const chord = computed(() => modifiers.some(modifier => modifier.value));
  const plain = (key: string) => () => keys[key].value && !chord.value && canFire.value;

  // Toggles
  whenever(plain("m"), () => player.toggleMute());
  whenever(plain("s"), () => queue.toggleShuffle());
  whenever(plain("r"), () => queue.toggleRepeat());

  // Queue panel
  whenever(plain("q"), () => {
    if (rightPanel.isOpen && rightPanel.view === "queue") {
      rightPanel.close();
    }
    else {
      rightPanel.openQueue();
    }
  });

  // Search
  whenever(
    () => (keys["ctrl+f"].value || keys["meta+f"].value) && canFire.value,
    () => {
      const wasCompact = leftSidebar.value.width < SIDEBAR_EXPANDED_MIN_WIDTH;
      if (wasCompact) {
        restoreCompactOnClose = true;
      }
      expandLeftSidebar();
      openSearch({ fromCompactExpand: wasCompact });
      requestAnimationFrame(() => {
        const searchInput = document.querySelector<HTMLInputElement>(
          "[data-sidebar-header] input",
        );
        searchInput?.focus();
      });
    },
  );

  return { isEnabled };
};
