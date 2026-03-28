<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import RangeSelector from "@/modules/player/components/RangeSelector.vue";
import SidebarMusic from "@/modules/player/components/SidebarMusic.vue";
import PlayBarControls from "@/modules/player/components/PlayBarControls.vue";
import SidebarControls from "@/modules/player/components/SidebarControls.vue";
import FooterMobile from "./FooterMobile.vue";

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
    </aside>
    <FooterMobile class="hidden" />
  </footer>
</template>
