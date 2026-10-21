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

  // Toggles
  whenever(() => keys.m.value && canFire.value, () => player.toggleMute());
  whenever(() => keys.s.value && canFire.value, () => queue.toggleShuffle());
  whenever(() => keys.r.value && canFire.value, () => queue.toggleRepeat());

  // Queue panel
  whenever(() => keys.q.value && canFire.value, () => {
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
