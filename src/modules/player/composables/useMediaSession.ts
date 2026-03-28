import { useQueueStore } from "@/modules/queue/store/queue.store";
import { usePlayerStore } from "../store/player.store";
import { onMounted, onUnmounted, ref } from "vue";
import { watch } from "vue";

const POSITION_UPDATE_INTERVAL = 1000;

export const useMediaSession = () => {
  const isSupported = "mediaSession" in navigator;
  if (!isSupported) return;

  const player = usePlayerStore();
  const queue = useQueueStore();

  let lastPositionUpdate = 0;
  let lastReportedPosition = 0;

  const forceNextUpdate = ref(false);

  const updateMetadata = () => {
    const track = player.currentTrack;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || "Unknown Title",
      artist: track.artist || "Unknown Artist",
    });
  };

  const updatePositionState = (force = false) => {
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
        position: position,
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
      });
      setActionHandler("seekforward", (details) => {
        const offset = details.seekOffset || 10;
        player.seekTo(Math.min(player.duration, player.currentTime + offset));
        forceNextUpdate.value = true;
      });
      setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          player.seekTo(details.seekTime);
          forceNextUpdate.value = true;
        }
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

    navigator.mediaSession.metadata = null;
  });

  watch(
    () => player.currentTrack,
    () => {
      updateMetadata();
      updateAvailableActions();
      lastReportedPosition = 0;
      updatePositionState(true);
    },
    { immediate: true },
  );

  watch(
    () => player.isPlaying,
    (isPlaying) => {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      updatePositionState(true);
    },
    { immediate: true },
  );

  watch(
    () => player.duration,
    () => {
      updatePositionState(true);
      updateAvailableActions();
    },
  );

  watch(() => player.canSeek, updateAvailableActions);

  watch([() => queue.hasNext, () => queue.hasPrevious], updateAvailableActions);

  let positionInterval: ReturnType<typeof setInterval> | null = null;

  watch(
    () => player.isPlaying,
    (isPlaying) => {
      if (isPlaying) {
        positionInterval = setInterval(() => {
          updatePositionState();
        }, POSITION_UPDATE_INTERVAL);
      }
      else {
        if (positionInterval) {
          clearInterval(positionInterval);
          positionInterval = null;
        }
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (positionInterval) {
      clearInterval(positionInterval);
    }
  });
};
