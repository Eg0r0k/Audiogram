import { Track } from "@/modules/player/types";
import { ref, watch } from "vue";

const activeTrack = ref<Track | null>(null);
const activeIndex = ref<number | null>(null);

const isDropdownOpen = ref(false);
const isContextMenuOpen = ref(false);

const dropdownAnchor = ref({ x: 0, y: 0, width: 0, height: 0 });

let lastCloseTime = 0;
let lastClosedTrackId: string | null = null;

watch(isDropdownOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) {
    lastCloseTime = Date.now();
    lastClosedTrackId = activeTrack.value?.id ?? null;

    if (!isContextMenuOpen.value) {
      activeTrack.value = null;
      activeIndex.value = null;
    }
  }
});

watch(isContextMenuOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) {
    if (!isDropdownOpen.value) {
      activeTrack.value = null;
      activeIndex.value = null;
    }
  }
});

export function useTrackMenu() {
  const openMenu = (track: Track, index: number) => {
    activeTrack.value = track;
    activeIndex.value = index;
    isContextMenuOpen.value = true;
  };

  const closeMenu = () => {
    isContextMenuOpen.value = false;
  };

  const openDropdown = (track: Track, index: number, event: MouseEvent) => {
    const timeSinceClose = Date.now() - lastCloseTime;
    if (timeSinceClose < 150 && lastClosedTrackId === track.id) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    activeTrack.value = track;
    activeIndex.value = index;

    dropdownAnchor.value = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };

    isDropdownOpen.value = true;
  };

  const closeDropdown = () => {
    isDropdownOpen.value = false;
  };

  return {
    activeTrack,
    activeIndex,
    isDropdownOpen,
    isContextMenuOpen,
    dropdownAnchor,
    openMenu,
    closeMenu,
    openDropdown,
    closeDropdown,
  };
}
