import type { Track } from "@/modules/player/types";
import type { TrackContext } from "@/modules/tracks/components/menu/type";
import type { QueueItemId } from "@/types/ids";
import { ref, watch } from "vue";

const activeTrack = ref<Track | null>(null);
const activeIndex = ref<number | null>(null);
const activeQueueItemId = ref<QueueItemId | null>(null);

const isDropdownOpen = ref(false);
const isContextMenuOpen = ref(false);
const activeDropdownTarget = ref<TrackContext>("default");
const activeContextMenuTarget = ref<TrackContext>("default");

const dropdownAnchor = ref({ x: 0, y: 0, width: 0, height: 0 });

let lastCloseTime = 0;
let lastClosedTrackId: string | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

function clearActiveState() {
  activeTrack.value = null;
  activeIndex.value = null;
  activeQueueItemId.value = null;
}

function cancelPendingReset() {
  if (!resetTimer) return;
  clearTimeout(resetTimer);
  resetTimer = null;
}

function scheduleReset() {
  cancelPendingReset();
  resetTimer = setTimeout(() => {
    if (isDropdownOpen.value || isContextMenuOpen.value) return;
    clearActiveState();
  }, 120);
}

watch(isDropdownOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) {
    lastCloseTime = Date.now();
    lastClosedTrackId = activeTrack.value?.id ?? null;

    if (!isContextMenuOpen.value) {
      scheduleReset();
    }
  }
});

watch(isContextMenuOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) {
    if (!isDropdownOpen.value) {
      scheduleReset();
    }
  }
});

interface OpenTrackMenuOptions {
  queueItemId?: QueueItemId | null;
  target?: TrackContext;
}

export function useTrackMenu() {
  const openMenu = (
    track: Track,
    index: number,
    options?: OpenTrackMenuOptions,
  ) => {
    cancelPendingReset();
    activeTrack.value = track;
    activeIndex.value = index;
    activeQueueItemId.value = options?.queueItemId ?? null;
    activeContextMenuTarget.value = options?.target ?? "default";
    isDropdownOpen.value = false;
    isContextMenuOpen.value = true;
  };

  const closeMenu = () => {
    isContextMenuOpen.value = false;
  };

  const openDropdown = (
    track: Track,
    index: number,
    event: MouseEvent,
    options?: OpenTrackMenuOptions,
  ) => {
    const timeSinceClose = Date.now() - lastCloseTime;
    if (timeSinceClose < 150 && lastClosedTrackId === track.id) {
      return;
    }

    cancelPendingReset();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    activeTrack.value = track;
    activeIndex.value = index;
    activeQueueItemId.value = options?.queueItemId ?? null;
    activeDropdownTarget.value = options?.target ?? "default";

    dropdownAnchor.value = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };

    isContextMenuOpen.value = false;
    isDropdownOpen.value = true;
  };

  const closeDropdown = () => {
    isDropdownOpen.value = false;
  };

  return {
    activeTrack,
    activeIndex,
    activeQueueItemId,
    isDropdownOpen,
    isContextMenuOpen,
    activeDropdownTarget,
    activeContextMenuTarget,
    dropdownAnchor,
    openMenu,
    closeMenu,
    openDropdown,
    closeDropdown,
  };
}
