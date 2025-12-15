import { ref } from "vue";
import type { Track } from "@/types/track/track";

const activeTrack = ref<Track | null>(null);
const activeIndex = ref<number | null>(null);

export function useTrackMenu() {
  const openMenu = (track: Track, index: number) => {
    activeTrack.value = track;
    activeIndex.value = index;
  };

  const closeMenu = () => {
  };

  return {
    activeTrack,
    activeIndex,
    openMenu,
    closeMenu,
  };
}
