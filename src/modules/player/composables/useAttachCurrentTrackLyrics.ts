import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useAttachTrackLyrics } from "@/modules/tracks/composables/useAttachTrackLyrics";
import { usePlayerStore } from "../store/player.store";
import { isLibraryTrack } from "../types";

export const useAttachCurrentTrackLyrics = () => {
  const playerStore = usePlayerStore();
  const { t } = useI18n();
  const { attachTrackLyrics, isAttachingLyrics } = useAttachTrackLyrics();

  // An .lrc is stored against a library row, so an ephemeral track (YouTube,
  // radio, "open with") has nothing to attach it to.
  const attachableTrack = computed(() =>
    isLibraryTrack(playerStore.currentTrack) ? playerStore.currentTrack : null,
  );

  const attachLabel = computed(() =>
    t(attachableTrack.value?.lyricsPath
      ? "track.contextMenu.replaceLyrics"
      : "track.contextMenu.addLyrics"),
  );

  // The mutation reports its own failures with a toast.
  const attachLyrics = () => {
    const track = attachableTrack.value;
    if (!track) return;
    attachTrackLyrics(track).catch(() => {});
  };

  return { attachableTrack, attachLabel, isAttachingLyrics, attachLyrics };
};
