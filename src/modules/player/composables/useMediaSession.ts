import { useQueueStore } from "@/modules/queue/store/queue.store";
import { usePlayerStore } from "../store/player.store";
import { onMounted, onUnmounted, ref, computed, watch } from "vue";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";

const POSITION_UPDATE_INTERVAL = 1000;

export const useMediaSession = () => {
  const isSupported = "mediaSession" in navigator;
  if (!isSupported) return;

  const player = usePlayerStore();
  const queue = useQueueStore();

  let lastPositionUpdate = 0;
  let lastReportedPosition = 0;

  let positionInterval: ReturnType<typeof setInterval> | null = null;
  let seekCommitTimer: ReturnType<typeof setTimeout> | null = null;

  const forceNextUpdate = ref(false);
  const isMediaSessionSeeking = ref(false);

  const currentTrack = computed(() => player.currentTrack);
  const albumId = computed(() =>
    currentTrack.value?.kind === "library" ? currentTrack.value.albumId : null,
  );

  const { url: coverBlobUrl } = useEntityCover("album", albumId);

  const updateMetadata = () => {
    const track = player.currentTrack;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artwork = coverBlobUrl.value
      ? [{ src: coverBlobUrl.value, sizes: "512x512", type: "image/jpeg" }]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "Unknown Title",
      artist: track.artist || "Unknown Artist",
      album: track.albumName || "",
      artwork,
    });
  };

  const updatePositionState = (force = false) => {
    if (isMediaSessionSeeking.value && !force) {
      return;
    }

    if (!player.canSeek || player.duration <= 0) {
      try {
        navigator.mediaSession.setPositionState();
      }
      catch {
        // noop
      }
      return;
    }

    const now = Date.now();
    const position = Math.max(0, Math.min(player.currentTime, player.duration));

    if (!force && !forceNextUpdate.value) {
      const timeSinceLastUpdate = now - lastPositionUpdate;
      const positionDelta = Math.abs(position - lastReportedPosition);

      if (timeSinceLastUpdate < POSITION_UPDATE_INTERVAL && positionDelta < 2) {
        return;
      }
    }

    forceNextUpdate.value = false;

    try {
      navigator.mediaSession.setPositionState({
        duration: player.duration,
        playbackRate: 1.0,
        position,
      });

      lastPositionUpdate = now;
      lastReportedPosition = position;
    }
    catch (err) {
      console.warn("[MediaSession] Failed to set position state:", err);
    }
  };

  const setActionHandler = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    }
    catch {
      // noop
    }
  };

  const updateAvailableActions = () => {
    setActionHandler(
      "nexttrack",
      queue.hasNext ? () => queue.next() : null,
    );

    setActionHandler(
      "previoustrack",
      queue.hasPrevious ? () => queue.previous() : null,
    );

    if (player.canSeek) {
      setActionHandler("seekbackward", (details) => {
        const offset = details.seekOffset || 10;

        player.seekTo(Math.max(0, player.currentTime - offset));

        forceNextUpdate.value = true;
        updatePositionState(true);
      });

      setActionHandler("seekforward", (details) => {
        const offset = details.seekOffset || 10;

        player.seekTo(Math.min(player.duration, player.currentTime + offset));

        forceNextUpdate.value = true;
        updatePositionState(true);
      });

      setActionHandler("seekto", (details) => {
        if (details.seekTime === undefined) return;

        isMediaSessionSeeking.value = true;

        if (seekCommitTimer) {
          clearTimeout(seekCommitTimer);
        }

        player.seekTo(details.seekTime);

        seekCommitTimer = setTimeout(() => {
          isMediaSessionSeeking.value = false;
          forceNextUpdate.value = true;
          updatePositionState(true);
        }, details.fastSeek ? 300 : 0);
      });
    }
    else {
      setActionHandler("seekbackward", null);
      setActionHandler("seekforward", null);
      setActionHandler("seekto", null);
    }
  };

  onMounted(() => {
    setActionHandler("play", () => player.play());
    setActionHandler("pause", () => player.pause());
    setActionHandler("stop", () => player.stop());

    updateAvailableActions();
  });

  onUnmounted(() => {
    const actions: MediaSessionAction[] = [
      "play",
      "pause",
      "stop",
      "previoustrack",
      "nexttrack",
      "seekbackward",
      "seekforward",
      "seekto",
    ];

    for (const action of actions) {
      setActionHandler(action, null);
    }

    if (positionInterval) {
      clearInterval(positionInterval);
      positionInterval = null;
    }

    if (seekCommitTimer) {
      clearTimeout(seekCommitTimer);
      seekCommitTimer = null;
    }

    navigator.mediaSession.metadata = null;
  });

  watch(
    () => player.currentTrack,
    () => {
      updateMetadata();
      updateAvailableActions();

      lastPositionUpdate = 0;
      lastReportedPosition = 0;

      forceNextUpdate.value = true;
      updatePositionState(true);
    },
    { immediate: true },
  );

  watch(
    () => player.isPlaying,
    (isPlaying) => {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      updatePositionState(true);

      if (isPlaying) {
        if (!positionInterval) {
          positionInterval = setInterval(() => {
            updatePositionState();
          }, POSITION_UPDATE_INTERVAL);
        }
      }
      else if (positionInterval) {
        clearInterval(positionInterval);
        positionInterval = null;
      }
    },
    { immediate: true },
  );

  watch(
    () => player.duration,
    () => {
      forceNextUpdate.value = true;
      updatePositionState(true);
      updateAvailableActions();
    },
  );

  watch(
    coverBlobUrl,
    () => {
      updateMetadata();
    },
  );

  watch(
    () => player.canSeek,
    () => {
      updateAvailableActions();
    },
  );

  watch(
    [() => queue.hasNext, () => queue.hasPrevious],
    () => {
      updateAvailableActions();
    },
  );
};
