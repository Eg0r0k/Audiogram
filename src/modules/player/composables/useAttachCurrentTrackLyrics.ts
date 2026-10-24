import { computed } from "vue";
import { usePlayerStore } from "../store/player.store";
import { isLibraryTrack } from "../types";

export const useAttachCurrentTrackLyrics = () => {
  const playerStore = usePlayerStore();

  // An .lrc is stored against a library row, so an ephemeral track (YouTube,
  // radio, "open with") has nothing to attach it to.
  const attachableTrack = computed(() =>
    isLibraryTrack(playerStore.currentTrack) ? playerStore.currentTrack : null,
  );

  return { attachableTrack };
};
