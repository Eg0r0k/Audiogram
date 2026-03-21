<template>
  <div class="flex flex-col  max-w-lg w-full mx-auto min-h-0 p-8">
    <div class="flex justify-center items-start">
      <div
        class="aspect-square max-w-100 max-h-[calc(100dvh-22.5rem)] w-[min(100%,calc(100dvh-22.5rem))] rounded-xl bg-muted flex items-center justify-center overflow-hidden"
      >
        <NuxtImage
          fallback-src="/img/fallback.svg"
          :alt="currentTrack?.title ?? ''"
          :placeholder="true"
          class="size-full object-cover"
        />
      </div>
    </div>

    <div class=" pt-5">
      <div class="flex items-center justify-between gap-2">
        <div class="data-track min-w-0 w-fill max-w-fit overflow-hidden mx-2">
          <MarqueeBlock
            :duration="10"
            animate-on-overflow-only
            pause-on-hover
            gradient
            gradient-color="var(--background)"
            gradient-length="20px"
          >
            <span class=" text-lg font-semibold">{{ currentTrack?.title }}</span>
          </MarqueeBlock>
          <MarqueeBlock
            :duration="6"
            animate-on-overflow-only
            pause-on-hover
            gradient
            gradient-color="var(--background)"
            gradient-length="20px"
          >
            <span class="text-muted-foreground capitalize">
              {{ currentTrack?.artist }}
            </span>
          </MarqueeBlock>
        </div>
        <Button
          class=" rounded-full"
          variant="ghost"
          size="icon-lg"
        >
          <IconDots class="size-7" />
        </Button>
      </div>
      <div class="flex flex-col gap-3 pt-4">
        <Slider />
        <div class="flex justify-between w-full text-foreground/50 text-sm ">
          <span>
            {{ timeDisplay.current }}
          </span>
          <span>
            {{ timeDisplay.duration }}
          </span>
        </div>
      </div>
      <div class="flex pb-4 gap-5 w-full justify-center items-center mt-7">
        <Button
          class="rounded-full"

          size="icon-lg"
          variant="ghost"

          :disabled="!queueStore.hasPrevious"
          @click="queueStore.previous()"
        >
          <IconBack class="size-6" />
        </Button>
        <PlayButton class="size-16!" />
        <Button
          class="rounded-full"

          variant="ghost"
          size="icon-lg"

          :disabled="!queueStore.hasNext"
          @click="queueStore.next()"
        >
          <IconForvard class="size-6" />
        </Button>
      </div>
    </div>
    <div class="flex   gap-3 items-center justify-between mt-auto">
      <Button
        size="icon-lg"
        variant="ghost"
        :class="repeatModeClass"
        @click="playerStore.toggleRepeat"
      >
        <IconRepeatOnce
          v-if="playerStore.repeatMode === 'one'"
          class="size-7"
        />
        <IconRepeat
          v-else
          class="size-7"
        />
      </Button>
      <Button
        size="icon-lg"
        variant="ghost"
        :class="{ 'text-primary': playerStore.isShuffled }"
        @click="queueStore.toggleShuffle()"
      >
        <IconShuffle class=" size-7" />
      </Button>
      <Button
        size="icon-lg"
        variant="ghost"
      >
        <IconPlaylist class=" size-7" />
      </Button>
      <Button
        size="icon-lg"
        variant="ghost"
      >
        <IconClocs class=" size-7" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import IconMusic from "~icons/tabler/music";

import IconPlaylist from "~icons/tabler/playlist";

import IconClocs from "~icons/tabler/stopwatch";

import IconBack from "~icons/tabler/player-skip-back-filled";
import IconForvard from "~icons/tabler/player-skip-forward-filled";

import IconRepeat from "~icons/tabler/repeat";
import IconShuffle from "~icons/tabler/arrows-shuffle";
import IconRepeatOnce from "~icons/tabler/repeat-once";

import IconDots from "~icons/tabler/dots";

import Slider from "@/components/ui/slider/Slider.vue";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import PlayButton from "@/modules/player/components/PlayButton.vue";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { formatDuration } from "@/lib/format/time";
import { ref } from "vue";

defineEmits<{
  close: [];
}>();

const playerStore = usePlayerStore();
const queueStore = useQueueStore();

const currentTrack = computed(() => playerStore.currentTrack);
const repeatModeClass = computed(() => ({
  "text-primary": playerStore.repeatMode !== "off",
}));
const timeDisplay = computed(() => {
  if (playerStore.isLiveStream) return { current: "🔴", duration: "LIVE" };
  return {
    current: formatDuration(playerStore.currentTime),
    duration: formatDuration(playerStore.duration),
  };
});
</script>
