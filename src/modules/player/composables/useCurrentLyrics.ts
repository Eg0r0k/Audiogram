import { computed } from "vue";
import { storeToRefs } from "pinia";
import type { LyricsLine } from "../lib/lrc";
import { useLyricsStore } from "../store/lyrics.store";
import { usePlayerStore } from "../store/player.store";

export const useCurrentLyrics = () => {
  const playerStore = usePlayerStore();
  const lyricsStore = useLyricsStore();
  const { kind, lines, plainLines, status, reason, source, raw, activeLineIndex, offsetMs } = storeToRefs(lyricsStore);

  const track = computed(() => playerStore.currentTrack);

  const seekToLine = (line: LyricsLine) => {
    if (!playerStore.canSeek) return;
    playerStore.seekTo(Math.max(0, line.time + offsetMs.value / 1000));
  };

  return { track, kind, lines, plainLines, status, reason, source, raw, activeLineIndex, offsetMs, seekToLine };
};
