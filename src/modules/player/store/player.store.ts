import { defineStore } from "pinia";
import { computed, ref, shallowRef, markRaw, watch } from "vue";
import { Player, type PlayerState } from "lyra-audio";
import Hls from "hls.js";
import { useAudioSettingsStore } from "@/modules/settings/store/audio";
import type { PlayerTrack, RepeatMode, Track } from "../types";
import { isLiveStreamTrack } from "../utils";
import { TrackSource } from "@/db/entities";
import { IS_TAURI } from "@/lib/environment/userAgent";
import { storageService } from "@/db/storage";
import { statsService } from "@/services/stats.service";
import { TrackId } from "@/types/ids";
import { findActiveLyricsIndex, parseLrc, type LyricsLine } from "../lib/lrc";

export const usePlayerStore = defineStore("player", () => {
  const player = shallowRef<Player | null>(null);

  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const repeatMode = ref<RepeatMode>("off");
  const status = ref<PlayerState>("idle");
  const currentTrack = ref<PlayerTrack | null>(null);
  const graphRevision = ref(0);
  const trackEndedSignal = ref(0);
  const lyrics = ref<LyricsLine[]>([]);
  const lyricsStatus = ref<"idle" | "loading" | "ready" | "error">("idle");

  let lyricsRequestId = 0;

  let _activeFadeAbort: AbortController | null = null;

  const cancelActiveFade = () => {
    if (_activeFadeAbort) {
      _activeFadeAbort.abort();
      _activeFadeAbort = null;
    }
  };

  const isPlaying = computed(
    () => status.value === "playing" || status.value === "buffering",
  );
  const isLoading = computed(() => status.value === "loading");

  const progress = computed(() => {
    if (duration.value <= 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  const canPlay = computed(() => player.value?.isReady ?? false);
  const activeLyricsIndex = computed(() =>
    findActiveLyricsIndex(lyrics.value, currentTime.value),
  );

  const isLiveStream = computed(() => {
    const track = currentTrack.value;
    const url = track && "url" in track ? track.url : undefined;
    return isLiveStreamTrack({ duration: duration.value, url });
  });

  const canSeek = computed(() => {
    if (!player.value) return false;
    if (isLiveStream.value) return false;
    if (duration.value <= 0) return false;
    return true;
  });

  const initPlayer = async () => {
    cancelActiveFade();

    if (player.value) {
      const oldPlayer = player.value;
      player.value = null;
      await oldPlayer.dispose();
    }

    const audioSettings = useAudioSettingsStore();

    const newPlayer = new Player({
      mode: "auto",
      Hls,
      loudnessNormalization: {
        enabled: audioSettings.isNormalizationEnabled,
        targetLufs: audioSettings.normalizationTargetLufs,
        preventClipping: audioSettings.normalizationPreventClipping,
      },
    });

    newPlayer.setVolume(volume.value);
    newPlayer.setMuted(isMuted.value);

    player.value = markRaw(newPlayer);

    newPlayer.on("statechange", ({ to }) => {
      if (player.value !== newPlayer) return;
      status.value = to;
    });

    newPlayer.on("ended", () => {
      if (player.value !== newPlayer) return;
      currentTime.value = 0;
      trackEndedSignal.value++;
    });

    newPlayer.on("timeupdate", ({ currentTime: t }) => {
      if (player.value !== newPlayer) return;
      currentTime.value = t;
    });

    newPlayer.on("durationchange", (dur) => {
      if (player.value !== newPlayer) return;
      duration.value = dur;
    });

    newPlayer.on("loadedmetadata", ({ duration: dur }) => {
      if (player.value !== newPlayer) return;
      duration.value = dur;
    });

    newPlayer.on("canplay", () => {
      if (player.value !== newPlayer) return;
      if (player.value) duration.value = player.value.duration;
      graphRevision.value++;
    });

    newPlayer.on("volumechange", ({ volume: vol, muted }) => {
      if (player.value !== newPlayer) return;
      volume.value = vol;
      isMuted.value = muted;
    });

    newPlayer.on("normalizationchange", (payload) => {
      if (player.value !== newPlayer) return;
      console.log("[Player] normalizationchange", payload);
    });

    newPlayer.on("error", (err) => {
      if (player.value !== newPlayer) return;
      console.error("[Player] error:", err);
    });

    return newPlayer;
  };
  // ! DELETE LATER
  const applyTrackLoudnessMetadata = (p: Player, track: PlayerTrack) => {
    if (typeof track.integratedLufs === "number") {
      p.setLoudnessMetadata({
        integratedLufs: track.integratedLufs,
        truePeakDbtp: track.truePeakDbtp,
      });
      return;
    }

    p.clearLoudnessMetadata();
  };

  const resolveTrackUrl = async (track: PlayerTrack): Promise<string | null> => {
    if ("url" in track && track.url) {
      return track.url;
    }

    if (!("storagePath" in track) || !track.storagePath) {
      return null;
    }

    if ("source" in track && track.source === TrackSource.LOCAL_EXTERNAL) {
      if (!IS_TAURI) return null;
      const result = await storageService.getAudioUrl(track.storagePath);
      return result.isOk() ? result.value : null;
    }

    const result = await storageService.getFile(track.storagePath);
    if (result.isErr()) return null;

    return URL.createObjectURL(result.value);
  };

  const loadUrl = async (p: Player, url: string) => {
    const normalized = String(url).trim().toLowerCase();
    const isHlsUrl
      = normalized.includes(".m3u8")
        || normalized.includes("application/vnd.apple.mpegurl");

    console.log("[PlayerStore] loadUrl", {
      originalUrl: url,
      normalized,
      isHlsUrl,
      playerModeBeforeLoad: p.mode,
      hasHlsCtor: !!Hls,
    });

    if (isHlsUrl) {
      console.log("[PlayerStore] loadUrl -> HLS source");
      await p.load({ url, type: "hls" });
      console.log("[PlayerStore] loadUrl <- HLS loaded");
    }
    else {
      console.log("[PlayerStore] loadUrl -> regular url");
      await p.load(url);
      console.log("[PlayerStore] loadUrl <- regular url loaded");
    }
  };
  const play = async () => {
    if (!player.value) {
      const track = currentTrack.value;
      if (!track) return;

      const url = await resolveTrackUrl(track);
      if (!url) {
        currentTrack.value = null;
        status.value = "idle";
        return;
      }

      const p = await initPlayer();
      await loadUrl(p, url);
      if (currentTime.value > 0) p.seek(currentTime.value);
      await p.play();
      return;
    }

    const wasCancellingFade = _activeFadeAbort !== null;
    cancelActiveFade();
    if (wasCancellingFade) player.value.cancelFade();

    const audioSettings = useAudioSettingsStore();
    const shouldFade = audioSettings.isFadeEnabled && audioSettings.fadeInDuration > 0;

    if (wasCancellingFade && player.value.isPlaying) {
      if (shouldFade) {
        await player.value.fadeTo(
          isMuted.value ? 0 : volume.value,
          audioSettings.fadeInDuration,
        );
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
      player.value.setVolume(volume.value);
      await player.value.play();
    }
  };
  const pause = () => {
    if (!player.value || !isPlaying.value || _activeFadeAbort) return;

    const audioSettings = useAudioSettingsStore();
    const shouldFade = audioSettings.isFadeEnabled && audioSettings.fadeOutDuration > 0;

    if (shouldFade) {
      const ac = new AbortController();
      _activeFadeAbort = ac;
      player.value.fadeOut(audioSettings.fadeOutDuration).then(() => {
        if (ac.signal.aborted) return;
        player.value?.pause();
        _activeFadeAbort = null;
      });
    }
    else {
      player.value.pause();
    }
  };

  const togglePlay = async () => {
    if (_activeFadeAbort) {
      cancelActiveFade();
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

    cancelActiveFade();

    const audioSettings = useAudioSettingsStore();
    const shouldFade = audioSettings.isFadeEnabled && audioSettings.fadeOutDuration > 0;

    if (shouldFade) {
      const ac = new AbortController();
      _activeFadeAbort = ac;
      player.value.fadeOut(audioSettings.fadeOutDuration).then(() => {
        if (ac.signal.aborted) return;
        player.value?.stop();
        _activeFadeAbort = null;
        currentTime.value = 0;
      });
    }
    else {
      player.value.stop();
      currentTime.value = 0;
    }
  };

  const playPlayerTrack = async (track: PlayerTrack) => {
    statsService.stopListening(currentTime.value);
    const p = await initPlayer();
    currentTrack.value = track;

    try {
      if ("file" in track && track.file) {
        await p.load(track.file);
        applyTrackLoudnessMetadata(p, track);
        await play();
        return;
      }
      let url: string | null = null;

      if ("url" in track && track.url) {
        url = track.url;
      }
      else if ("source" in track && track.source === TrackSource.LOCAL_EXTERNAL) {
        if (!IS_TAURI) {
          console.warn("[Player] LOCAL_EXTERNAL not supported in web");
          status.value = "error";
          player.value = null;
          return;
        }

        const result = await storageService.getAudioUrl(track.storagePath);
        if (result.isErr()) {
          throw new Error(`getAudioUrl failed: ${result.error.message}`);
        }
        url = result.value;
      }
      else if ("storagePath" in track && track.storagePath) {
        const result = await storageService.getAudioUrl(track.storagePath);
        if (result.isErr()) {
          throw new Error(`getAudioUrl failed: ${result.error.message}`);
        }
        url = result.value;
      }

      if (!url) {
        throw new Error("Cannot resolve track source");
      }

      await loadUrl(p, url);
      applyTrackLoudnessMetadata(p, track);
      await play();
    }
    catch (err) {
      console.error("[Player] playPlayerTrack failed:", err);
      status.value = "error";
      player.value = null;
    }
  };

  const seekTo = (seconds: number) => {
    if (!canSeek.value) return;
    cancelActiveFade();
    player.value?.seek(seconds);
  };

  const seekPercent = (percent: number) => {
    if (!canSeek.value) return;
    cancelActiveFade();
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
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const idx = modes.indexOf(repeatMode.value);
    repeatMode.value = modes[(idx + 1) % modes.length];
  };

  const dispose = async () => {
    cancelActiveFade();
    if (player.value) {
      await player.value.dispose();
      player.value = null;
    }
  };

  const getAudioGraph = () => {
    return player.value?.graph ?? null;
  };

  watch(currentTrack, (track) => {
    if (!track || !("artistId" in track)) return;
    statsService.startListening(
      track.id as TrackId,
      (track as Track).artistId,
      (track as Track).albumId,
      (track as Track).duration,
    );
  });

  watch(currentTrack, async (track) => {
    const requestId = ++lyricsRequestId;

    lyrics.value = [];
    lyricsStatus.value = "idle";

    if (!track || !("lyricsPath" in track) || !track.lyricsPath) {
      return;
    }

    lyricsStatus.value = "loading";

    const result = await storageService.getFile(track.lyricsPath);
    if (requestId !== lyricsRequestId) return;

    if (result.isErr()) {
      lyricsStatus.value = "error";
      return;
    }

    try {
      const text = await result.value.text();
      if (requestId !== lyricsRequestId) return;

      lyrics.value = parseLrc(text);
      lyricsStatus.value = "ready";
    }
    catch {
      if (requestId !== lyricsRequestId) return;
      lyricsStatus.value = "error";
    }
  }, { immediate: true });

  watch(trackEndedSignal, (val) => {
    if (val === 0) return;
    statsService.stopListening(currentTime.value, true);
  });

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
    currentTrack,
    lyrics,
    lyricsStatus,
    activeLyricsIndex,
    graphRevision,
    trackEndedSignal,
    progress,
    canPlay,
    isLiveStream,
    canSeek,
    play,
    pause,
    togglePlay,
    playPlayerTrack,
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
      "currentTrack",
      "currentTime",
      "duration",
    ],
  },
});
