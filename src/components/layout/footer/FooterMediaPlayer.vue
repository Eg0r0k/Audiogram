<script setup lang="ts">
import PlayBarControls from "@/components/player/PlayBarControls.vue";
import PlayerBarNotification from "@/components/player/PlayerBarNotification.vue";
import SidebarControls from "@/components/player/SidebarControls.vue";
import SidebarMusic from "@/components/player/SidebarMusic.vue";
import { AnimatePresence, Motion } from "motion-v";
import { ref, computed, watch, onUnmounted } from "vue";
import FooterMobile from "./FooterMobile.vue";
import RangeSelector from "@/components/player/RangeSelector.vue";
import { usePlayerStore } from "@/stores/player.store";

const isOpen = ref(false);
const playerStore = usePlayerStore();

const isScrubbing = ref(false);
const scrubValue = ref(0);

const localProgress = ref(0);
const rafId = ref<number | null>(null);
const isTransitionEnabled = ref(true);

const startRAF = () => {
  if (rafId.value || isScrubbing.value) return;

  const update = () => {
    if (isScrubbing.value) {
      rafId.value = null;
      return;
    }

    const player = playerStore.player;
    if (player && player.duration > 0 && isFinite(player.duration as number)) {
      const currentTime = player.currentTime as number;
      const duration = player.duration as number;
      localProgress.value = (currentTime / duration) * 100;
    }

    if (playerStore.isPlaying) {
      rafId.value = requestAnimationFrame(update);
    }
    else {
      rafId.value = null;
    }
  };

  rafId.value = requestAnimationFrame(update);
};

const stopRAF = () => {
  if (rafId.value) {
    cancelAnimationFrame(rafId.value);
    rafId.value = null;
  }
};

const syncProgress = () => {
  const player = playerStore.player;
  if (player && player.duration > 0 && isFinite(player.duration as number)) {
    const currentTime = player.currentTime as number;
    const duration = player.duration as number;
    localProgress.value = (currentTime / duration) * 100;
  }
};

watch(
  () => playerStore.isPlaying,
  (playing) => {
    if (playing) {
      startRAF();
    }
    else {
      stopRAF();
      syncProgress();
    }
  },
);

watch(
  () => playerStore.currentTrack?.id,
  (newId, oldId) => {
    if (newId === oldId) return;

    isTransitionEnabled.value = false;
    isScrubbing.value = false;
    localProgress.value = 0;

    stopRAF();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTransitionEnabled.value = true;

        if (playerStore.isPlaying) {
          startRAF();
        }
      });
    });
  },
);

watch(
  () => playerStore.status,
  (status) => {
    if (status === "playing" && !rafId.value && !isScrubbing.value) {
      startRAF();
    }
  },
);

onUnmounted(() => {
  stopRAF();
});

const displayProgress = computed(() => {
  if (playerStore.isLiveStream) {
    return 0;
  }
  if (isScrubbing.value) {
    return scrubValue.value;
  }
  return localProgress.value;
});

const onScrubStart = () => {
  if (!playerStore.canSeek) return;

  isScrubbing.value = true;
  scrubValue.value = localProgress.value;
  stopRAF();
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

  const targetPercent = scrubValue.value;

  localProgress.value = targetPercent;
  isScrubbing.value = false;

  playerStore.seekPercent(targetPercent);

  if (playerStore.isPlaying) {
    setTimeout(() => {
      startRAF();
    }, 50);
  }
};

</script>

<template>
  <footer class="p-3 bg-card ">
    <aside>
      <div class="relative flex items-center justify-between ">
        <div
          class="absolute -left-[11px] -top-3.5 -right-[11px]"
          :class="{ 'pointer-events-none opacity-50': !playerStore.canSeek }"
        >
          <RangeSelector
            :model-value="displayProgress"
            :step="1000 / 60 / 1000"
            :keyboard-step="5"
            :min="0"
            :max="100"
            :use-transform="true"
            :with-transition="false"
            :disable-transition="!isTransitionEnabled"
            :disabled="!playerStore.canSeek"
            @mousedown="onScrubStart"
            @scrub="onScrub"
            @mouseup="onScrubEnd"
          />
        </div>

        <SidebarMusic />
        <PlayBarControls />

        <SidebarControls />
      </div>

      <AnimatePresence>
        <Motion
          v-if="isOpen"
          :initial="{ opacity: 0, y: 20, height: 0 }"
          :animate="{ opacity: 1, y: 0, height: 'auto' }"
          :exit="{ opacity: 0, y: 20, height: 0 }"
          :transition="{ duration: 0.2, ease: 'easeInOut' }"
          class="overflow-hidden"
        >
          <PlayerBarNotification />
        </Motion>
      </AnimatePresence>
    </aside>
    <FooterMobile class="hidden" />
  </footer>
</template>
