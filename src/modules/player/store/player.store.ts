import { defineStore } from "pinia";
import { computed, ref, shallowRef, markRaw } from "vue";
import { Player } from "@egor/lyra";
import Hls from "hls.js";
import { LocalTrack, PlayerTrack, RepeatMode } from "../types";

export const usePlayerStore = defineStore("player", () => {
  const player = shallowRef<Player | null>(null);

  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const repeatMode = ref<RepeatMode>("off");
  const isShuffled = ref(false);
  const status = ref<"idle" | "loading" | "ready" | "playing" | "paused" | "error">("idle");

  const currentTrack = ref<PlayerTrack | null>(null);

  const progress = computed(() => {
    if (duration.value <= 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });
  const canPlay = computed(() => player.value?.isReady ?? false);
  const canGoNext = computed(() => false); // TODO: implement with queue
  const canGoPrevious = computed(() => false); // TODO: implement with queue

  const initPlayer = async () => {
    if (player.value) {
      await player.value.dispose();
    }

    const newPlayer = new Player({
      mode: "auto",
      Hls: Hls,
    });
    newPlayer.setVolume(volume.value);
    newPlayer.setMuted(isMuted.value);

    player.value = markRaw(newPlayer);

    newPlayer.on("play", () => {
      isPlaying.value = true;
      status.value = "playing";
    });

    newPlayer.on("pause", () => {
      isPlaying.value = false;
      status.value = "paused";
    });

    newPlayer.on("ended", () => {
      isPlaying.value = false;
      currentTime.value = 0;
      status.value = "ready";

      if (repeatMode.value === "one") {
        play();
      }
      else {
        // TODO: next track from queue
      }
    });

    newPlayer.on("timeupdate", (payload) => {
      currentTime.value = payload.currentTime as number;
    });

    newPlayer.on("durationchange", (dur) => {
      duration.value = dur as number;
    });
    newPlayer.on("loadstart", () => {
      isLoading.value = true;
      status.value = "loading";
    });

    newPlayer.on("canplay", () => {
      isLoading.value = false;
      status.value = "ready";
      if (player.value) {
        duration.value = player.value.duration as number;
      }
    });
    newPlayer.on("loadedmetadata", ({ duration: dur }) => {
      duration.value = dur as number;
    });

    newPlayer.on("statechange", ({ to }) => {
      status.value = to as typeof status.value;
    });

    newPlayer.on("volumechange", ({ volume: vol, muted }) => {
      volume.value = vol;
      isMuted.value = muted;
    });
    newPlayer.on("error", (err) => {
      console.error("Player error:", err);
      status.value = "error";
      isLoading.value = false;
    });

    return newPlayer;
  };

  const play = async () => {
    // Try to restore source
    if (!player.value) {
      if (currentTrack.value && "url" in currentTrack.value) {
        await playUrl(currentTrack.value.url as string);
        if (currentTime.value > 0 && player.value) {
          (player.value as Player).seek(currentTime.value);
        }
        return;
      }
      return;
    }

    await player.value.play();
  };
  const pause = () => {
    player.value?.pause();
  };

  const togglePlay = async () => {
    if (isPlaying.value) {
      pause();
    }
    else {
      await play();
    }
  };

  const stop = () => {
    player.value?.stop();
    currentTime.value = 0;
    status.value = "ready";
  };

  const playTrack = async (track: LocalTrack) => {
    await initPlayer();

    if (!player.value) return;

    currentTrack.value = track;

    try {
      if (!track.url) {
        throw new Error("Track has no URL");
      }
      await player.value.load(track.url);
      await player.value.play();
    }
    catch (err) {
      console.error("Failed to play track:", err);
      status.value = "error";
    }
  };
  const playFile = async (file: File) => {
    await initPlayer();

    if (!player.value) return;

    const localTrack: LocalTrack = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      file,
    };

    currentTrack.value = localTrack;

    try {
      await player.value.load(file);
      localTrack.duration = player.value.duration;
      await player.value.play();
    }
    catch (err) {
      console.error("Failed to play file:", err);
      status.value = "error";
    }
  };

  const playUrl = async (url: string) => {
    await initPlayer();

    if (!player.value) return;

    const localTrack: LocalTrack = {
      id: crypto.randomUUID(),
      title: url.split("/").pop()?.split("?")[0] || "Stream",
      artist: "Stream",
      url,
    };

    currentTrack.value = localTrack;

    try {
      await player.value.load(url);
      localTrack.duration = player.value.duration;
      await player.value.play();
    }
    catch (err) {
      console.error("Failed to play URL:", err);
      status.value = "error";
    }
  };

  const isLiveStream = computed(() => {
    if (!isFinite(duration.value) || duration.value === 0) {
      return true;
    }

    const track = currentTrack.value;
    const url = (track && "url" in track ? track.url : undefined)?.toLowerCase() ?? "";

    if (url.includes(".m3u8") || url.includes("stream") || url.includes("radio")) {
      if (duration.value > 86400) {
        return true;
      }
    }

    return false;
  });

  const seekTo = (seconds: number) => {
    if (!canSeek.value) {
      console.log("[Store] Seek disabled for live stream");
      return;
    }
    player.value?.seek(seconds);
  };

  const canSeek = computed(() => {
    if (!player.value) return false;
    if (isLiveStream.value) return false;
    if (duration.value <= 0) return false;
    return true;
  });

  const seekPercent = (percent: number) => {
    if (!canSeek.value) {
      console.log("[Store] Seek disabled for live stream");
      return;
    }
    player.value?.seekPercent(percent / 100);
  };

  const setVolume = (value: number) => {
    volume.value = value;
    player.value?.setVolume(value);
  };

  const setMuted = (muted: boolean) => {
    isMuted.value = muted;
    player.value?.setMuted(muted);
  };

  const toggleMute = () => {
    player.value?.toggleMute();
    isMuted.value = player.value?.muted ?? false;
  };

  const toggleShuffle = () => {
    isShuffled.value = !isShuffled.value;
    // TODO: shuffle queue
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode.value);
    repeatMode.value = modes[(currentIndex + 1) % modes.length];
  };

  const next = () => {
    // TODO: implement with queue
    console.log("next");
  };

  const previous = () => {
    // TODO: implement with queue
    console.log("previous");
  };

  // Cleanup
  const dispose = async () => {
    if (player.value) {
      await player.value.dispose();
      player.value = null;
    }
  };

  // Get audio graph for equalizer
  const getAudioGraph = () => {
    return player.value?.graph ?? null;
  };

  return {
    // State
    player,
    status,
    currentTime,
    duration,
    volume,
    isMuted,
    isPlaying,
    isLoading,
    repeatMode,
    isShuffled,
    currentTrack,

    // Computed
    progress,
    canPlay,
    canGoNext,
    canGoPrevious,
    isLiveStream,
    canSeek,
    // Actions
    play,
    pause,
    togglePlay,
    playTrack,
    playFile,
    playUrl,
    stop,
    next,
    previous,
    seekTo,
    seekPercent,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    getAudioGraph,
    dispose,
    setMuted,
  };
},
{
  persist: {
    key: "lyra-player",
    pick: [
      "volume",
      "isMuted",
      "repeatMode",
      "isShuffled",
      "currentTrack",
      "currentTime",
      "duration",

    ],

  },
},

);
