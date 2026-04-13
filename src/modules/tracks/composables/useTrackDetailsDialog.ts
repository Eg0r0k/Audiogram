import { ref } from "vue";
import type { Track } from "@/modules/player/types";

const isOpen = ref(false);
const activeTrack = ref<Track | null>(null);

export function useTrackDetailsDialog() {
  const openTrackDetails = (track: Track) => {
    activeTrack.value = track;
    isOpen.value = true;
  };

  const closeTrackDetails = () => {
    isOpen.value = false;
    activeTrack.value = null;
  };

  return {
    isOpen,
    activeTrack,
    openTrackDetails,
    closeTrackDetails,
  };
}
