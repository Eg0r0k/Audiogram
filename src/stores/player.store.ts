import { defineStore } from "pinia";
import { useQueueStore } from "./queue.store";
import { computed, readonly, ref } from "vue";
import { REPEAT_MODES, RepeatMode } from "@/types/player/types";
import { Track } from "@/types/track/track";

const VOLUME_STORAGE_KEY = "player_volume";
const PLAYER_SETTINGS_KEY = "player_settings";

export const usePlayerStore = defineStore("player", () => {
  const queueStore = useQueueStore();

  const currentTime = ref(0);
  const duration = ref(0);
  const repeatMode = ref<RepeatMode>("off");
  const status = ref("idle");

  const progress = computed(() =>
    duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0,
  );

  const play = () => {
    throw new Error("not implemented");
  };
  const pause = () => {
    throw new Error("not implemented");
  };

  // TODO implement this
  const canPlay = computed(() => false);
  const canGoNext = computed(() => false);
  const canGoPrevious = computed(() => false);

  const togglePlay = () => {
    if (canPlay.value) {
      pause();
    }
    else {
      play();
    }
  };

  const stop = () => {
    throw new Error("not implemented");
  };

  const cycleRepeatMode = () => {
    const currentIndex = REPEAT_MODES.indexOf(repeatMode.value);
    repeatMode.value = REPEAT_MODES[(currentIndex + 1) % REPEAT_MODES.length];
  };

  const playTrack = (track: Track): void => {
    throw new Error("not implemented");
  };

  const next = () => {
    throw new Error("not implemented");
  };

  const previous = () => {
    throw new Error("not implemented");
  };

  const seekTo = (seconds: number) => {
    throw new Error("not implemented");
  };

  const setVolume = () => {
    throw new Error("not implemented");
  };

  const toggleMute = () => {
    throw new Error("not implemented");
  };

  const toggleShuffle = () => {
    throw new Error("not implemented");
  };

  const toggleRepeat = () => {
    throw new Error("not implemented");
  };

  return {
    // States
    status: readonly(status),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    repeatMode: readonly(repeatMode),
    // Computed
    progress,
    canPlay,
    canGoNext,
    canGoPrevious,
    // Functions
    play,
    pause,
    togglePlay,
    playTrack,
    stop,
    next,
    previous,
    seekTo,
    toggleRepeat,

  };
});
