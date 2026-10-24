import { useQueueStore } from "@/modules/queue/store/queue.store";
import { usePlayerStore } from "../store/player.store";
import { onMounted, onUnmounted, ref, computed, shallowRef, watch } from "vue";
import { trackCoverOwner, useTrackCover } from "@/modules/covers/composables/useTrackCover";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";
import { getLogger } from "@/lib/logger";
import { useCurrentPlayerTrack } from "./useCurrentPlayerTrack";
import { isEphemeralTrack, isLibraryTrack } from "../types";
import { formatError } from "@/lib/errors";

const POSITION_UPDATE_INTERVAL = 1000;
// Both the browser's media session and Android's extrapolate the position
// from the last report and its playback rate, so a periodic re-push while
// playing only costs a bridge hop a second. What they cannot see is a jump
// — a seek, a stall, a rate the bridge cannot carry — so the store position
// is checked against where the last report should have advanced to, and a
// report goes out only when the two disagree by this much.
const POSITION_DRIFT_TOLERANCE_S = 1.5;
const ANDROID_ARTWORK_SIZE = 512;
// Longer than the cover slide (useTrackSwipe's SLIDE_TRANSITION).
const ARTWORK_ENCODE_DELAY_MS = 400;
// MIUI's media notification takes the art that comes with a text change and
// ignores a later artwork-only update: a title pushed ahead of its art left
// the placeholder up for the whole track. Metadata waits for the current
// owner's artwork this long and goes out with it in one push.
export const ARTWORK_WAIT_MS = 1500;
const EPHEMERAL_COVER_TIMEOUT_MS = 10_000;
const MEDIA_DURATION_TOLERANCE_MS = 1000;

/**
 * Native bridge injected by MainActivity on Android (Tauri). The WebView
 * implements `navigator.mediaSession` but never surfaces it to the system
 * (no media notification / lock-screen controls), so the state is mirrored
 * into a native MediaSession through this object.
 */
interface AndroidMediaSessionBridge {
  setMetadata: (title: string, artist: string, album: string, artworkBase64: string, durationMs: number) => void;
  setPlaybackState: (
    playing: boolean,
    positionMs: number,
    canSeek: boolean,
    hasNext: boolean,
    hasPrevious: boolean,
    repeatMode: string,
    liked: boolean,
    canLike: boolean,
  ) => void;
  release: () => void;
}

declare global {
  interface Window {
    AudiogramMediaSession?: AndroidMediaSessionBridge;
  }
}

interface AndroidMediaActionDetail {
  action?: string;
  positionMs?: number;
}

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
  };
  reader.onerror = () => resolve("");
  reader.readAsDataURL(blob);
});

// The notification only needs a small bitmap; multi-megabyte originals are
// wasteful to push over the JS bridge, so downscale to a JPEG first.
const coverArtworkBase64 = async (blob: Blob): Promise<string> => {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, ANDROID_ARTWORK_SIZE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    // OffscreenCanvas.convertToBlob waits for idle time and takes ~4 s in a hidden page.
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return await blobToBase64(blob);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  }
  catch {
    return blobToBase64(blob);
  }
};

const fetchCoverBlob = async (url: string): Promise<Blob | null> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(EPHEMERAL_COVER_TIMEOUT_MS) });
    return response.ok ? await response.blob() : null;
  }
  catch {
    return null;
  }
};

const positiveDurationMs = (seconds: number | null | undefined) =>
  typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;

export const useMediaSession = () => {
  const isSupported = "mediaSession" in navigator;
  const androidBridge = window.AudiogramMediaSession;
  if (!isSupported && !androidBridge) return;

  const player = usePlayerStore();
  const queue = useQueueStore();
  const { toggleTrackLike } = useToggleTrackLike();

  let lastPositionUpdate = 0;
  let lastReportedPosition = 0;

  let seekCommitTimer: ReturnType<typeof setTimeout> | null = null;

  const forceNextUpdate = ref(false);
  const isMediaSessionSeeking = ref(false);

  const { libraryTrack } = useCurrentPlayerTrack();

  const { url: coverBlobUrl, blob: libraryCoverBlob, isLoading: libraryCoverLoading } = useTrackCover(libraryTrack);

  const ephemeralCoverUrl = computed(() => {
    const track = player.currentTrack;
    return isEphemeralTrack(track) && track.cover ? track.cover : null;
  });

  const artworkKey = computed(() => {
    const owner = trackCoverOwner(libraryTrack.value);
    if (owner) return `${owner.ownerType}:${owner.ownerId}`;
    return ephemeralCoverUrl.value ? `url:${ephemeralCoverUrl.value}` : null;
  });

  let ephemeralCoverToken = 0;
  const fetchedEphemeralCover = shallowRef<{ url: string; blob: Blob | null } | null>(null);

  const artworkBlob = computed(() => {
    if (libraryTrack.value) return libraryCoverBlob.value;
    const fetched = fetchedEphemeralCover.value;
    return fetched && fetched.url === ephemeralCoverUrl.value ? fetched.blob : null;
  });

  const artworkLoading = computed(() => {
    if (libraryTrack.value) return libraryCoverLoading.value;
    const url = ephemeralCoverUrl.value;
    return url !== null && fetchedEphemeralCover.value?.url !== url;
  });

  const browserArtworkSrc = computed(() =>
    (libraryTrack.value ? coverBlobUrl.value : ephemeralCoverUrl.value) ?? null);

  const updateMetadata = () => {
    const track = player.currentTrack;

    if (isSupported) {
      if (!track) {
        navigator.mediaSession.metadata = null;
      }
      else {
        const artwork = browserArtworkSrc.value
          ? [{ src: browserArtworkSrc.value, sizes: "512x512", type: "image/jpeg" }]
          : [];

        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || "Unknown Title",
          artist: track.artist || "Unknown Artist",
          album: track.albumName || "",
          artwork,
        });
      }
    }

    updateAndroidMetadata();
  };

  // Every bridge method is a synchronous hop into the Java side, and a track
  // change fires several watchers in one flush (metadata, actions, position,
  // playback state) — inside the very frame that renders the change, where
  // the hops added up to ~15 ms on a phone. Each push only marks what is
  // stale; one task later a single setMetadata and setPlaybackState carry
  // the latest state.
  const NO_POSITION_OVERRIDE = Symbol("noPositionOverride");
  let bridgeFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let metadataStale = false;
  let playbackStale = false;
  let playbackPositionOverrideMs: number | typeof NO_POSITION_OVERRIDE = NO_POSITION_OVERRIDE;

  const flushBridge = () => {
    bridgeFlushTimer = null;
    if (metadataStale) {
      metadataStale = false;
      pushAndroidMetadata();
    }
    if (playbackStale) {
      playbackStale = false;
      const override = playbackPositionOverrideMs;
      playbackPositionOverrideMs = NO_POSITION_OVERRIDE;
      pushAndroidPlayback(override === NO_POSITION_OVERRIDE ? undefined : override);
    }
  };

  const scheduleBridgeFlush = () => {
    if (bridgeFlushTimer === null) bridgeFlushTimer = setTimeout(flushBridge, 0);
  };

  const cancelBridgeFlush = () => {
    if (bridgeFlushTimer !== null) clearTimeout(bridgeFlushTimer);
    bridgeFlushTimer = null;
    metadataStale = false;
    playbackStale = false;
    playbackPositionOverrideMs = NO_POSITION_OVERRIDE;
  };

  const updateAndroidPlayback = (positionOverrideMs?: number) => {
    if (!androidBridge || !player.currentTrack) return;
    playbackStale = true;
    if (positionOverrideMs !== undefined) playbackPositionOverrideMs = positionOverrideMs;
    scheduleBridgeFlush();
  };

  const pushAndroidPlayback = (positionOverrideMs?: number) => {
    if (!androidBridge || !player.currentTrack) return;

    const track = player.currentTrack;
    const canLike = isLibraryTrack(track);

    const positionMs = positionOverrideMs ?? Math.max(0, player.currentTime * 1000);
    lastPositionUpdate = Date.now();
    lastReportedPosition = positionMs / 1000;
    androidBridge.setPlaybackState(
      player.isPlaybackIntended,
      positionMs,
      player.canSeek,
      queue.hasNext,
      queue.hasPrevious,
      queue.repeatMode,
      canLike && track.isLiked,
      canLike,
    );
  };

  let androidArtworkToken = 0;
  // Encoded artwork tagged with its artwork key (cover owner: album, or the
  // track itself for album-less files; or an ephemeral track's cover URL).
  // At track-change time the artwork for a NEW key hasn't resolved yet, and
  // pushing whatever blob is currently around pins the previous art on the
  // lock screen; the tag makes "matches this track" checkable.
  const encodedArtworkKey = ref<string | null>(null);
  let artworkBase64 = "";
  let artworkWaitTimer: ReturnType<typeof setTimeout> | null = null;
  // Key whose artwork wait ran out: its metadata goes without art.
  let artworkWaitExpiredFor: string | null = null;
  let mediaDurationMs = 0;

  // True once the artwork question for the current key is settled: encoded
  // for it, or known to have no cover.
  const artworkReady = computed(() => {
    const key = artworkKey.value;
    if (key === null || encodedArtworkKey.value === key) return true;
    return !artworkLoading.value && artworkBlob.value === null;
  });

  const cancelArtworkWait = () => {
    if (artworkWaitTimer !== null) clearTimeout(artworkWaitTimer);
    artworkWaitTimer = null;
  };

  const startArtworkWait = () => {
    if (artworkWaitTimer !== null) return;
    artworkWaitTimer = setTimeout(() => {
      artworkWaitTimer = null;
      artworkWaitExpiredFor = artworkKey.value;
      updateAndroidMetadata();
    }, ARTWORK_WAIT_MS);
  };

  const updateAndroidMetadata = () => {
    if (!androidBridge) return;

    if (!player.currentTrack) {
      // Nothing to show any more: the session goes away right now, and a
      // push still pending for the previous track must not resurrect it.
      cancelBridgeFlush();
      androidBridge.release();
      return;
    }

    metadataStale = true;
    scheduleBridgeFlush();
  };

  const pushAndroidMetadata = () => {
    if (!androidBridge) return;

    const track = player.currentTrack;
    if (!track) return;

    if (!artworkReady.value && artworkWaitExpiredFor !== artworkKey.value) {
      metadataStale = true;
      startArtworkWait();
      return;
    }
    cancelArtworkWait();

    const artwork = artworkKey.value !== null && artworkKey.value === encodedArtworkKey.value
      ? artworkBase64
      : "";

    androidBridge.setMetadata(
      track.title || "Unknown Title",
      track.artist || "Unknown Artist",
      track.albumName || "",
      artwork,
      positiveDurationMs(track.duration) || mediaDurationMs,
    );
    // The flush pushes playback right after metadata.
    playbackStale = true;
  };

  const handleAndroidAction = (event: Event) => {
    const detail = (event as CustomEvent<AndroidMediaActionDetail | null>).detail;
    switch (detail?.action) {
      case "play":
        player.play().catch(error => getLogger().error(`[Player] Play from the media session failed: ${formatError(error)}`));
        break;
      case "pause":
        player.pause();
        break;
      case "stop":
        player.stop();
        break;
      case "next":
        if (queue.hasNext) {
          queue.next().catch(error => getLogger().error(`[Queue] Next from the media session failed: ${formatError(error)}`));
        }
        break;
      case "previous":
        if (queue.hasPrevious) {
          queue.previous().catch(error => getLogger().error(`[Queue] Previous from the media session failed: ${formatError(error)}`));
        }
        break;
      case "seekto":
        if (typeof detail.positionMs === "number" && player.canSeek) {
          player.seekTo(detail.positionMs / 1000);
          // The store's currentTime only updates on the next engine
          // timeupdate — report the seek target itself, or the lock-screen
          // scrubber snaps back to the old position for a second.
          updateAndroidPlayback(detail.positionMs);
        }
        break;
      case "repeat":
        queue.toggleRepeat();
        updateAndroidPlayback();
        break;
      case "like": {
        const track = player.currentTrack;
        // mutateAsync rethrows; the user already sees the toast from onError.
        if (track && isLibraryTrack(track)) {
          toggleTrackLike(track).catch(error => getLogger().error(`[Player] Toggling like from the media session failed: ${formatError(error)}`));
        }
        break;
      }
      default:
        break;
    }
  };

  const updatePositionState = (force = false) => {
    if (!isSupported) return;

    if (isMediaSessionSeeking.value && !force) {
      return;
    }

    if (!player.canSeek || (player.duration ?? 0) <= 0) {
      try {
        navigator.mediaSession.setPositionState();
      }
      catch {
        // noop
      }
      return;
    }

    const now = Date.now();
    const position = Math.max(0, Math.min(player.currentTime, player.duration ?? 0));

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
        duration: player.duration ?? 0,
        playbackRate: player.playbackRate,
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
      queue.hasNext
        ? () => {
            queue.next().catch(error => getLogger().error(`[Queue] Next from the media session failed: ${formatError(error)}`));
          }
        : null,
    );

    setActionHandler(
      "previoustrack",
      queue.hasPrevious
        ? () => {
            queue.previous().catch(error => getLogger().error(`[Queue] Previous from the media session failed: ${formatError(error)}`));
          }
        : null,
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

        player.seekTo(Math.min(player.duration ?? 0, player.currentTime + offset));

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
    setActionHandler("play", () => {
      player.play().catch(error => getLogger().error(`[Player] Play from the media session failed: ${formatError(error)}`));
    });
    setActionHandler("pause", () => player.pause());
    setActionHandler("stop", () => player.stop());

    updateAvailableActions();

    if (androidBridge) {
      window.addEventListener("audiogram-media-action", handleAndroidAction);
    }
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

    if (seekCommitTimer) {
      clearTimeout(seekCommitTimer);
      seekCommitTimer = null;
    }

    if (isSupported) {
      navigator.mediaSession.metadata = null;
    }

    if (androidBridge) {
      window.removeEventListener("audiogram-media-action", handleAndroidAction);
      cancelBridgeFlush();
      cancelArtworkWait();
      androidBridge.release();
    }
  });

  watch(
    () => player.currentTrack,
    (track, previous) => {
      if (track?.id !== previous?.id) mediaDurationMs = 0;
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
    () => player.isPlaybackIntended,
    (isPlaying) => {
      if (isSupported) {
        navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      }
      updatePositionState(true);
      updateAndroidPlayback();
    },
    { immediate: true },
  );

  const expectedPosition = () =>
    lastReportedPosition + ((Date.now() - lastPositionUpdate) / 1000) * player.playbackRate;

  watch(
    () => player.currentTime,
    (position) => {
      if (!player.isPlaybackIntended || isMediaSessionSeeking.value) return;
      if (Math.abs(position - expectedPosition()) < POSITION_DRIFT_TOLERANCE_S) return;
      updatePositionState(true);
      updateAndroidPlayback();
    },
  );

  watch(
    () => player.playbackRate,
    () => {
      updatePositionState(true);
      updateAndroidPlayback();
    },
  );

  watch(
    () => player.duration,
    () => {
      forceNextUpdate.value = true;
      updatePositionState(true);
      updateAvailableActions();
      updateAndroidPlayback();
    },
  );

  watch(
    () => player.duration,
    (seconds) => {
      const track = player.currentTrack;
      if (!androidBridge || !track || positiveDurationMs(track.duration) > 0) return;
      const ms = positiveDurationMs(seconds);
      if (ms === 0 || Math.abs(ms - mediaDurationMs) <= MEDIA_DURATION_TOLERANCE_MS) return;
      mediaDurationMs = ms;
      updateAndroidMetadata();
    },
  );

  watch(
    browserArtworkSrc,
    () => {
      updateMetadata();
    },
  );

  watch(
    ephemeralCoverUrl,
    async (url) => {
      const token = ++ephemeralCoverToken;
      if (!androidBridge || url === null) return;
      const blob = await fetchCoverBlob(url);
      if (token === ephemeralCoverToken) fetchedEphemeralCover.value = { url, blob };
    },
    { immediate: true },
  );

  // The blob arriving means the artwork for the CURRENT key resolved: encode
  // it, remember which key it belongs to, and re-push metadata.
  watch(
    artworkBlob,
    async (blob) => {
      if (!androidBridge) return;
      const key = artworkKey.value;
      const token = ++androidArtworkToken;
      // Decoding and re-encoding the cover is main-thread work that would
      // otherwise land inside the cover slide that follows a track change;
      // the notification can show its art a moment later. Skipped from the
      // notification, there is no slide to protect.
      if (blob && document.visibilityState !== "hidden") {
        await new Promise(resolve => setTimeout(resolve, ARTWORK_ENCODE_DELAY_MS));
      }
      if (token !== androidArtworkToken) return;
      const encoded = blob ? await coverArtworkBase64(blob) : "";
      if (token !== androidArtworkToken) return;
      encodedArtworkKey.value = blob && key ? key : null;
      artworkBase64 = encoded;
      updateAndroidMetadata();
    },
  );

  watch(artworkKey, () => {
    cancelArtworkWait();
    artworkWaitExpiredFor = null;
  });

  watch(artworkReady, (ready) => {
    if (ready) updateAndroidMetadata();
  });

  watch(
    () => queue.repeatMode,
    () => {
      updateAndroidPlayback();
    },
  );

  watch(
    () => player.canSeek,
    () => {
      updateAvailableActions();
      updateAndroidPlayback();
    },
  );

  watch(
    [() => queue.hasNext, () => queue.hasPrevious],
    () => {
      updateAvailableActions();
      updateAndroidPlayback();
    },
  );
};
