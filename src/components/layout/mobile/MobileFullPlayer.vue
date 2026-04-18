<template>
  <div class="flex flex-col w-full mx-auto min-h-0 px-6 pt-4 pb-6 max-w-md">
    <div class="flex-1 min-h-0 [container-type:size] flex items-start justify-center pb-2">
      <div class="aspect-square w-[min(100cqw,100cqh)] rounded-2xl bg-muted overflow-hidden shadow-lg">
        <NuxtImage
          :src="coverUrl"
          fallback-src="/img/fallback.svg"
          :alt="currentTrack?.title ?? ''"
          :placeholder="true"
          class="size-full object-cover"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 mt-6">
      <div class="min-w-0 flex-1">
        <MarqueeBlock
          :duration="10"
          animate-on-overflow-only
          pause-on-hover
          gradient
          gradient-color="transparent"
          gradient-length="20px"
        >
          <span class="text-xl font-semibold leading-tight">{{ currentTrack?.title }}</span>
        </MarqueeBlock>
        <MarqueeBlock
          :duration="6"
          animate-on-overflow-only
          pause-on-hover
          gradient
          gradient-color="transparent"
          gradient-length="20px"
        >
          <span class="text-base text-white/60 capitalize mt-0.5 block">
            {{ currentTrack?.artist }}
          </span>
        </MarqueeBlock>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-lg"
          class="rounded-full"
          @click.stop="toggleLike"
        >
          <IconLikedFilled
            v-if="currentTrack?.isLiked"
            class="size-6 text-primary"
          />
          <IconLike
            v-else
            class="size-6"
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          class="rounded-full"
          @click.stop="onDotsClick"
        >
          <IconDots class="size-6" />
        </Button>
      </div>
    </div>

    <div class="mt-6 flex flex-col gap-2">
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
        :show-thumb="true"
        style="--range-height: 4px; --range-height-hover: 4px; --range-radius: 9999px;"
        @mousedown="onScrubStart"
        @scrub="onScrub"
        @mouseup="onScrubEnd"
      />
      <div class="flex justify-between text-xs text-white/50 font-medium tabular-nums">
        <span>{{ timeDisplay.current }}</span>
        <span>{{ timeDisplay.duration }}</span>
      </div>
    </div>

    <div class="flex items-center justify-between mt-6 px-2">
      <Button
        size="icon-lg"
        variant="ghost"
        class="rounded-full"
        :disabled="!queueStore.hasPrevious"
        @click.stop="queueStore.previous()"
      >
        <IconBack class="size-7" />
      </Button>
      <PlayButton
        class="size-18!"
        @click.stop
      />
      <Button
        size="icon-lg"
        variant="ghost"
        class="rounded-full"
        :disabled="!queueStore.hasNext"
        @click.stop="queueStore.next()"
      >
        <IconForvard class="size-7" />
      </Button>
    </div>

    <div class="flex items-center justify-between mt-6 px-1">
      <Button
        size="icon"
        variant="ghost"
        :class="repeatModeClass"
        @click.stop="playerStore.toggleRepeat"
      >
        <IconRepeatOnce
          v-if="playerStore.repeatMode === 'one'"
          class="size-5"
        />
        <IconRepeat
          v-else
          class="size-5"
        />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        :class="{ 'text-primary': queueStore.isShuffled }"
        @click.stop="queueStore.toggleShuffle()"
      >
        <IconShuffle class="size-5" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
      >
        <IconClocs class="size-5" />
      </Button>
    </div>

    <TrackDropdown />
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { formatDuration } from "@/lib/format/time";

import IconClocs from "~icons/tabler/stopwatch";
import IconBack from "~icons/tabler/player-skip-back-filled";
import IconForvard from "~icons/tabler/player-skip-forward-filled";
import IconRepeat from "~icons/tabler/repeat";
import IconShuffle from "~icons/tabler/arrows-shuffle";
import IconRepeatOnce from "~icons/tabler/repeat-once";
import IconDots from "~icons/tabler/dots";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";

import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import PlayButton from "@/modules/player/components/PlayButton.vue";
import type { Track } from "@/modules/player/types";
import { RangeSelector } from "@/modules/player";
import { usePlayerProgress } from "@/modules/tracks/composables/usePlayerProgress";

withDefaults(defineProps<{
  backgroundColor?: string | null;
}>(), {
  backgroundColor: null,
});

defineEmits<{
  close: [];
}>();

const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const { toggleTrackLike } = useToggleTrackLike();
const { openDropdown } = useTrackMenu();
const { displayProgress, isTransitionEnabled, onScrubStart, onScrub, onScrubEnd } = usePlayerProgress();

const currentTrack = computed<Track | null>(() => {
  const track = playerStore.currentTrack;
  return track?.kind === "library" ? track : null;
});

const { url: coverBlobUrl } = useEntityCover(
  "album",
  () => currentTrack.value?.albumId ?? null,
);

const coverUrl = computed(() => {
  const track = playerStore.currentTrack;
  if (!track) return undefined;
  if (track.kind === "ephemeral") return track.cover;
  return coverBlobUrl.value ?? undefined;
});

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

const toggleLike = async () => {
  if (!currentTrack.value) return;
  await toggleTrackLike(currentTrack.value);
};

const onDotsClick = (event: MouseEvent) => {
  if (!currentTrack.value) return;
  openDropdown(currentTrack.value, 0, event, { target: "default" });
};
</script>
