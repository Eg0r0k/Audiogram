import { ref, computed, watch, effectScope, onScopeDispose, type Ref, type EffectScope } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { FRAME_GRID_MS, snapToGrid } from "@/lib/frame-grid";

// Smallest move of the fill worth a render: half a pixel of the widest bar,
// the footer's, which spans the window. A fixed percentage instead jumped
// 2-2.5 px at a time on a wide window. The loop wakes once per that step
// instead of every display frame: a rAF loop kept the page producing frames
// at the display rate (144 Hz here) with a style recalc in each, 55 ms/s of
// main thread for movement no one can see.
const STEP_PX = 0.5;
const MAX_TICK_MS = 250;

const stepPercent = () => (STEP_PX / Math.max(1, window.innerWidth)) * 100;

interface ProgressTicker {
  scope: EffectScope;
  progress: Ref<number>;
  isTransitionEnabled: Ref<boolean>;
  subscribers: number;
}

// One loop for every bar on screen. Each usePlayerProgress instance used
// to run its own, and the mobile layout mounts two at once (mini player and
// full player): two loops reading the media element and writing two refs
// per frame for one position.
let ticker: ProgressTicker | null = null;

const createTicker = (): ProgressTicker => {
  const scope = effectScope(true);
  const progress = ref(0);
  const isTransitionEnabled = ref(true);

  scope.run(() => {
    const playerStore = usePlayerStore();
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const readProgress = (): number | null => {
      const player = playerStore.player;
      if (!player || player.duration <= 0 || !isFinite(player.duration)) return null;
      return ((player.currentTime as number) / (player.duration as number)) * 100;
    };

    const tickInterval = () => {
      const duration = playerStore.player?.duration;
      if (!duration || !isFinite(duration)) return MAX_TICK_MS;
      const ms = duration * 1000 * (stepPercent() / 100);
      return Math.min(MAX_TICK_MS, Math.max(FRAME_GRID_MS, ms));
    };

    // On a point of the shared 60 Hz frame grid (see frame-grid.ts), so the
    // bar repaints in frames the stepped animations draw anyway.
    const schedule = (run: () => void) => {
      const now = performance.now();
      return setTimeout(run, snapToGrid(now + tickInterval()) - now);
    };

    const stop = () => {
      if (timerId !== null) clearTimeout(timerId);
      timerId = null;
    };

    const start = () => {
      if (timerId !== null) return;
      const update = () => {
        const next = readProgress();
        // Half a step: a tick sized to one step sees a hair less whenever its
        // timer runs early, and a full-step bar dropped every other tick.
        if (next !== null && Math.abs(next - progress.value) >= stepPercent() / 2) progress.value = next;
        timerId = playerStore.isPlaying ? schedule(update) : null;
      };
      timerId = schedule(update);
    };

    const sync = () => {
      const next = readProgress();
      if (next !== null) progress.value = next;
    };

    watch(() => playerStore.isPlaying, (playing) => {
      if (playing) {
        start();
      }
      else {
        stop();
        sync();
      }
    });

    // The bar snaps to zero without animating, then transitions come back
    // once that frame has painted.
    const resumeTransitions = () => {
      isTransitionEnabled.value = true;
      if (playerStore.isPlaying) start();
    };

    const onTrackChanged = () => {
      isTransitionEnabled.value = false;
      progress.value = 0;
      stop();
      requestAnimationFrame(() => requestAnimationFrame(resumeTransitions));
    };

    watch(() => playerStore.currentTrack?.id, (newId, oldId) => {
      if (newId !== oldId) onTrackChanged();
    });

    watch(() => playerStore.status, (status) => {
      if (status === "playing") start();
    });

    // Paused, the loop is off and only a seek moves the position: its
    // timeupdate is the one signal that the bar is behind.
    watch(() => playerStore.currentTime, () => {
      if (!playerStore.isPlaying) sync();
    });

    sync();
    if (playerStore.isPlaying) start();
    onScopeDispose(stop);
  });

  return { scope, progress, isTransitionEnabled, subscribers: 0 };
};

const subscribe = (): ProgressTicker => {
  ticker ??= createTicker();
  ticker.subscribers++;
  const current = ticker;
  onScopeDispose(() => {
    current.subscribers--;
    if (current.subscribers === 0 && ticker === current) {
      current.scope.stop();
      ticker = null;
    }
  });
  return current;
};

export function usePlayerProgress() {
  const playerStore = usePlayerStore();
  const shared = subscribe();

  const isScrubbing = ref(false);
  const scrubValue = ref(0);

  const displayProgress = computed(() => {
    if (playerStore.isLiveStream) return 0;
    return isScrubbing.value ? scrubValue.value : shared.progress.value;
  });

  const onScrubStart = () => {
    if (!playerStore.canSeek) return;
    isScrubbing.value = true;
  };

  const onScrub = (value: number) => {
    if (!playerStore.canSeek) return;
    scrubValue.value = value;
  };

  const onScrubEnd = () => {
    if (!playerStore.canSeek) {
      isScrubbing.value = false;
      return;
    }
    // Optimistic: the element's position moves synchronously on seek, so the
    // next frame reads the target back; until then the bar holds it.
    shared.progress.value = scrubValue.value;
    isScrubbing.value = false;
    playerStore.seekPercent(scrubValue.value);
  };

  return {
    displayProgress,
    isTransitionEnabled: shared.isTransitionEnabled,
    isScrubbing,
    scrubValue,
    onScrubStart,
    onScrub,
    onScrubEnd,
  };
}
