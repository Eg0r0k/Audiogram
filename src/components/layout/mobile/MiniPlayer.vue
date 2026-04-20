<template>
  <button
    class="relative flex shrink-0 w-full h-14 px-2 cursor-pointer text-left [-webkit-tap-highlight-color:transparent]"
    :aria-label="$t('player.nowPlaying')"
    @click="$emit('click')"
  >
    <div
      class="relative flex-1 rounded-lg overflow-hidden transition-colors duration-300"
      :style="containerStyle"
    >
      <div class="flex items-center gap-2.5 px-2 h-14">
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
            <span class="text-[11px] text-white/80">
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
            class="rounded-full text-white"
            :aria-label="$t('player.nextTrack')"
            :disabled="!queueStore.hasNext"
            @click.stop="queueStore.next()"
          >
            <IconSkipForward class="size-5" />
          </Button>
        </div>
      </div>

      <div class="absolute bottom-0 left-2 right-2">
        <div class="h-0.5 w-full bg-white/50 rounded-full">
          <div
            class="h-full bg-white rounded-full "
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useMobilePlayerColor } from "@/composables/useMobilePlayerColor";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import IconPlay from "~icons/tabler/player-play-filled";
import IconPause from "~icons/tabler/player-pause-filled";
import IconSkipForward from "~icons/tabler/player-track-next-filled";

const playerStore = usePlayerStore();
const queueStore = useQueueStore();

defineEmits<{
  click: [];
}>();

const currentTrack = computed(() => playerStore.currentTrack);
const artistName = computed(() => currentTrack.value?.artist);

const { color: playerColor, coverUrl } = useMobilePlayerColor();

const containerStyle = computed(() => ({
  backgroundColor: playerColor.value.hsl,
}));

const gradientColor = computed(() => playerColor.value.hsl);

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

watch(() => playerStore.isPlaying, (playing) => {
  if (playing) {
    rafId = requestAnimationFrame(updateProgress);
  }
  else if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}, { immediate: true });

watch(() => currentTrack.value?.id, () => {
  progressPercent.value = 0;
});

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
});
</script>
