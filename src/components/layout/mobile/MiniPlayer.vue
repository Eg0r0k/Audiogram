<template>
  <button
    class="relative flex flex-col shrink-0 w-full px-2 pb-2 cursor-pointer text-left [-webkit-tap-highlight-color:transparent]"
    :aria-label="$t('player.nowPlaying')"
    @click="$emit('click')"
  >
    <div
      class="rounded-lg overflow-hidden transition-colors duration-300"
      :style="containerStyle"
    >
      <div class="h-0.5 w-full bg-white/20">
        <div
          class="h-full bg-white transition-[width] duration-300 ease-linear will-change-[width]"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <div class="flex items-center gap-2.5 px-3 py-2">
        <div class="size-10 shrink-0 rounded-md overflow-hidden flex items-center justify-center bg-black/20">
          <NuxtImage
            :src="coverUrl"
            :alt="currentTrack?.title ?? ''"
            fallback-src="/img/fallback.svg"
            class="size-full object-cover"
          />
        </div>

        <div class="flex-1 min-w-0 flex flex-col gap-px">
          <MarqueeBlock
            :duration="10"
            animate-on-overflow-only
            pause-on-hover
            gradient
            :gradient-color="gradientColor"
            gradient-length="20px"
          >
            <span class="text-sm font-medium leading-snug text-white">
              {{ currentTrack?.title ?? $t("player.nothing_playing") }}
            </span>
          </MarqueeBlock>
          <MarqueeBlock
            :duration="10"
            animate-on-overflow-only
            pause-on-hover
            gradient
            :gradient-color="gradientColor"
            gradient-length="20px"
          >
            <span class="text-[11px] text-white/70">
              {{ artistName ?? "" }}
            </span>
          </MarqueeBlock>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-lg"
            class="rounded-full text-white"
            :aria-label="playerStore.isPlaying ? $t('player.pause') : $t('player.play')"
            @click.stop="playerStore.togglePlay()"
          >
            <component
              :is="playerStore.isPlaying ? IconPause : IconPlay"
              class="size-5"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            class="rounded-full "
            :aria-label="$t('player.nextTrack')"
            :disabled="!queueStore.hasNext"
            @click.stop="queueStore.next()"
          >
            <IconSkipForward class="size-5" />
          </Button>
        </div>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useImageColor } from "@/composables/useImageColor";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconPlay from "~icons/tabler/player-play-filled";
import IconPause from "~icons/tabler/player-pause-filled";
import IconSkipForward from "~icons/tabler/player-track-next-filled";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import { useQueueStore } from "@/modules/queue/store/queue.store";

defineEmits<{
  click: [];
}>();

const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const currentTrack = computed(() => playerStore.currentTrack);
const artistName = computed(() => currentTrack.value?.artist);
const coverUrl = computed(() => {
  const track = currentTrack.value;
  if (!track) return undefined;
  return "cover" in track ? track.cover : undefined;
});

const { color, extractColor } = useImageColor({
  colorType: "Muted",
  lightness: 35,
  saturation: 50,
  fallback: "#2c2c2c",
});

const containerStyle = computed(() => ({
  backgroundColor: color.value.hsl,
}));

const gradientColor = computed(() => color.value.hsl);

watch(
  coverUrl,
  async (newCover) => {
    if (newCover) {
      await extractColor(newCover);
    }
  },
  { immediate: true },
);

const progressPercent = ref(0);
let rafId: number | null = null;

const updateProgress = () => {
  const player = playerStore.player;
  if (player && player.duration > 0 && isFinite(player.duration as number)) {
    progressPercent.value = ((player.currentTime as number) / (player.duration as number)) * 100;
  }

  if (playerStore.isPlaying) {
    rafId = requestAnimationFrame(updateProgress);
  }
};

watch(
  () => playerStore.isPlaying,
  (playing) => {
    if (playing) {
      rafId = requestAnimationFrame(updateProgress);
    }
    else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  },
  { immediate: true },
);

watch(
  () => currentTrack.value?.id,
  () => {
    progressPercent.value = 0;
  },
);

onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
});
</script>
