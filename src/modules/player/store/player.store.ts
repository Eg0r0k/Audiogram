import { defineStore } from "pinia";
import { computed, ref, shallowRef, markRaw } from "vue";
import { Player, type PlayerState } from "lyra-audio";
import Hls from "hls.js";
import { useAudioSettingsStore } from "@/modules/settings/store/audio";
import type { LocalTrack, PlayerTrack, RepeatMode } from "../types";
import { isLiveStreamTrack } from "../utils";

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

  const status = ref<PlayerState>("idle");

  const currentTrack = ref<PlayerTrack | null>(null);

  const graphRevision = ref(0);
  const trackEndedSignal = ref(0);

  let _pauseFadeAbort: AbortController | null = null;

  const cancelPauseFade = () => {
    if (_pauseFadeAbort) {
      _pauseFadeAbort.abort();
      _pauseFadeAbort = null;
    }
  };

  const progress = computed(() => {
    if (duration.value <= 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  const canPlay = computed(() => player.value?.isReady ?? false);

  const isLiveStream = computed(() => {
    const track = currentTrack.value;
    const url = track && "url" in track ? track.url : undefined;

    return isLiveStreamTrack({
      duration: duration.value,
      url,
    });
  });

  const canSeek = computed(() => {
    if (!player.value) return false;
    if (isLiveStream.value) return false;
    if (duration.value <= 0) return false;
    return true;
  });

  const initPlayer = async () => {
    cancelPauseFade();

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
      trackEndedSignal.value++;
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
      graphRevision.value++;
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
    if (!player.value) {
      if (currentTrack.value && "url" in currentTrack.value) {
        const url = currentTrack.value.url as string;
        // TODO: rewrite this
        if (url.startsWith("blob:")) {
          console.warn("[Player] Cannot restore blob URL from previous session");
          currentTrack.value = null;
          status.value = "idle";
          return;
        }
        await playUrl(url);
        if (currentTime.value > 0 && player.value) {
          (player.value as Player).seek(currentTime.value);
        }
        return;
      }
      return;
    }

    const wasCancellingFade = _pauseFadeAbort !== null;
    cancelPauseFade();

    const audioSettings = useAudioSettingsStore();
    const shouldFade = audioSettings.isFadeEnabled && audioSettings.fadeInDuration > 0;

    if (wasCancellingFade && player.value.isPlaying) {
      if (shouldFade) {
        const target = isMuted.value ? 0 : volume.value;
        await player.value.fadeTo(target, audioSettings.fadeInDuration);
      }
      else {
        player.value.setVolume(volume.value);
      }
      return;
    }

    if (shouldFade) {
      await player.value.fadeIn(audioSettings.fadeInDuration);
    }
    else {
    // Gain might be 0 from previous fadeOut — restore before playing
      player.value.setVolume(volume.value);
      await player.value.play();
    }
  };

  const pause = () => {
    if (!player.value || !isPlaying.value || _pauseFadeAbort) return;

    const audioSettings = useAudioSettingsStore();
    const shouldFade = audioSettings.isFadeEnabled && audioSettings.fadeOutDuration > 0;

    if (shouldFade) {
      const ac = new AbortController();
      _pauseFadeAbort = ac;

      player.value.fadeOut(audioSettings.fadeOutDuration).then(() => {
        if (ac.signal.aborted) return;
        player.value?.pause();
        _pauseFadeAbort = null;
      // Gain stays at 0 — play() will restore it
      });
    }
    else {
      player.value.pause();
    }
  };
  const togglePlay = async () => {
    if (_pauseFadeAbort) {
      cancelPauseFade();
      player.value?.cancelFade();
      player.value?.setVolume(volume.value);
      return;
    }
    if (isPlaying.value) {
      pause();
    }
    else {
      await play();
    }
  };

  const stop = () => {
    if (!player.value) return;

    cancelPauseFade();

    const audioSettings = useAudioSettingsStore();
    const shouldFade = audioSettings.isFadeEnabled && audioSettings.fadeOutDuration > 0;

    if (shouldFade) {
      const ac = new AbortController();
      _pauseFadeAbort = ac;

      player.value.fadeOut(audioSettings.fadeOutDuration).then(() => {
        if (ac.signal.aborted) return;
        player.value?.stop();
        _pauseFadeAbort = null;
        currentTime.value = 0;
      // Gain stays at 0 — play() will restore it
      });
    }
    else {
      player.value.stop();
      currentTime.value = 0;
      status.value = "ready";
    }
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
      await play();
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
      await play();
    }
    catch (err) {
      console.error("Failed to play file:", err);
      status.value = "error";
    }
  };

  const playUrl = async (url: string) => {
    await initPlayer();
    if (!player.value) return;

    try {
      await player.value.load(url);
      await play();
    }
    catch (err) {
      console.error("Failed to play URL:", err);
      status.value = "error";
    }
  };

  const seekTo = (seconds: number) => {
    if (!canSeek.value) return;
    cancelPauseFade();
    player.value?.seek(seconds);
  };

  const seekPercent = (percent: number) => {
    if (!canSeek.value) return;
    cancelPauseFade();
    player.value?.seekPercent(percent / 100);
  };

  const setVolume = (value: number) => {
    cancelPauseFade();
    volume.value = value;
    player.value?.setVolume(value);
  };

  const setMuted = (muted: boolean) => {
    cancelPauseFade();
    isMuted.value = muted;
    player.value?.setMuted(muted);
  };

  const toggleMute = () => {
    cancelPauseFade();
    player.value?.toggleMute();
    isMuted.value = player.value?.muted ?? false;
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const idx = modes.indexOf(repeatMode.value);
    repeatMode.value = modes[(idx + 1) % modes.length];
  };

  const dispose = async () => {
    cancelPauseFade();
    if (player.value) {
      await player.value.dispose();
      player.value = null;
    }
  };

  const getAudioGraph = () => {
    return player.value?.graph ?? null;
  };

  return {
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
    graphRevision,
    trackEndedSignal,

    progress,
    canPlay,
    isLiveStream,
    canSeek,

    play,
    pause,
    togglePlay,
    playTrack,
    playFile,
    playUrl,
    stop,
    seekTo,
    seekPercent,
    setVolume,
    toggleMute,
    toggleRepeat,
    getAudioGraph,
    dispose,
    setMuted,
  };
}, {
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
});
