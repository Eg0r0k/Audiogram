<template>
  <div class="pip-container">
    <div
      class="content-cover"
      :style="contentCoverStyle"
    >
      <div class="content ">
        <img
          v-if="showCover"
          :src="coverUrl"
          :alt="currentTrack?.title ?? ''"
          class="cover-image"
          draggable="false"
          @error="coverLoadFailed = true"
        >

        <div
          v-else
          class="content-fallback"
          :style="fallbackIconStyle"
        >
          <IconMusic class="content-fallback__icon" />
        </div>
      </div>
    </div>

    <div class="controls">
      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :class="{ 'text-primary': queueStore.isShuffled }"
        @click="queueStore.toggleShuffle()"
      >
        <IconArrowsShuffle2 class="size-4.5" />
      </Button>

      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :disabled="!queueStore.hasPrevious"
        @click="queueStore.previous()"
      >
        <IconPlayerTrackPrevFilled class="size-4.5" />
      </Button>

      <PlayButton class="size-10" />

      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :disabled="!queueStore.hasNext"
        @click="queueStore.next()"
      >
        <IconPlayerTrackNextFilled class="size-4.5" />
      </Button>

      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :class="{ 'text-primary': playerStore.repeatMode !== 'off' }"
        @click="playerStore.toggleRepeat()"
      >
        <IconRepeatOnce
          v-if="playerStore.repeatMode === 'one'"
          class="size-4.5"
        />
        <IconRepeat
          v-else
          class="size-4.5"
        />
      </Button>

      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :class="{ 'text-primary': isLiked }"
        @click="toggleLike"
      >
        <IconLikedFilled
          v-if="isLiked"
          class="size-4.5"
        />
        <IconLike
          v-else
          class="size-4.5"
        />
      </Button>
    </div>

    <div class="context-info">
      <MarqueeBlock
        :duration="6"
        animate-on-overflow-only
        pause-on-hover
        gradient
        gradient-color="var(--background)"
        gradient-length="20px"
      >
        <span class="context-info__title">
          {{ currentTrack?.title ?? "—" }}
        </span>
      </MarqueeBlock>

      <MarqueeBlock
        :duration="6"
        animate-on-overflow-only
        pause-on-hover
        gradient
        gradient-color="var(--background)"
        gradient-length="20px"
      >
        <span class="context-info__sub">
          {{ currentTrack?.artist ?? "" }}
        </span>
      </MarqueeBlock>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";
import { useMobilePlayerColor } from "@/composables/useMobilePlayerColor";
import { Button } from "@/components/ui/button";
import PlayButton from "@/modules/player/components/PlayButton.vue";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import type { Track } from "@/modules/player/types";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";
import IconArrowsShuffle2 from "~icons/tabler/arrows-shuffle-2";
import IconPlayerTrackPrevFilled from "~icons/tabler/player-track-prev-filled";
import IconPlayerTrackNextFilled from "~icons/tabler/player-track-next-filled";
import IconRepeat from "~icons/tabler/repeat";
import IconRepeatOnce from "~icons/tabler/repeat-once";
import IconMusic from "~icons/tabler/music";

const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const { toggleTrackLike } = useToggleTrackLike();

const currentTrack = computed<Track | null>(() => {
  const track = playerStore.currentTrack;
  return track?.kind === "library" ? track : null;
});

const isLiked = computed(() => currentTrack.value?.isLiked ?? false);

const { color: playerColor, coverUrl } = useMobilePlayerColor();

const coverLoadFailed = ref(false);

watch(
  coverUrl,
  () => {
    coverLoadFailed.value = false;
  },
  { immediate: true },
);

const showCover = computed(() => !!coverUrl.value && !coverLoadFailed.value);

const contentCoverStyle = computed(() => ({
  background: `linear-gradient(to bottom, ${playerColor.value.hsl}, black)`,
}));

const fallbackIconStyle = computed(() => ({
  color: playerColor.value.isDark
    ? "rgba(255, 255, 255, 0.72)"
    : "rgba(0, 0, 0, 0.60)",
}));

const toggleLike = async () => {
  if (!currentTrack.value) return;
  await toggleTrackLike(currentTrack.value);
};
</script>

<style lang="css">
:root {
  --context-info-height: 64px;
  --controls-height: 48px;
}

html, body, #app {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  scrollbar-color: hsla(0, 0%, 100%, .3) transparent;
  scrollbar-width: auto;
}
</style>

<style lang="css" scoped>
.pip-container {
  display: grid;
  user-select: none;
  grid-template-areas:
    "media media"
    "contextinfo controls";
  grid-template-rows: 1fr var(--context-info-height);
  grid-template-columns: 1fr auto;
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

.content-cover {
  grid-area: media;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 4px 4px 0;
  border-radius: 8px;
  min-height: 40px;
  overflow: hidden;
  transition: background 220ms ease;
}

.content {
  aspect-ratio: 1;
  width: auto;
  margin: 8px;
  height: 100%;
  max-width: 100%;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  pointer-events: none;
}

.content-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-fallback__icon {
  width: clamp(28px, 16%, 72px);
  height: clamp(28px, 16%, 72px);
}

.controls {
  grid-area: controls;
  display: flex;
  align-items: center;
  justify-content: center;
}

.context-info {
  grid-area: contextinfo;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 8px;
}

.context-info__title {
  font-weight: 700;
  font-size: clamp(16px, 3vw, 24px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-info__sub {
  font-weight: 500;
  color: var(--color-muted-foreground);
  font-size: clamp(12px, 3vw, 18px);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-height: 170px) {
  .pip-container {
    gap: 4px;
    grid-template-areas:
      "media contextinfo"
      "controls controls";
    grid-template-rows: 1fr var(--controls-height);
    grid-template-columns: auto 1fr;
    padding: 4px;
  }

  .content-cover {
    margin: auto 0;
    aspect-ratio: 1;
    min-width: 60px;
    max-height: 100%;
  }

  .controls {
    background: transparent;
    border-radius: 8px;
    padding: 4px 8px;
  }

  .context-info {
    padding: 0 8px;
  }
}

@media (min-height: 171px) {
  .controls {
    background: transparent;
  }
}

@media (max-height: 132px) {
  .pip-container {
    grid-template-areas: "media contextinfo controls";
    grid-template-columns: auto 1fr auto;
    grid-template-rows: 1fr;
    padding: 8px 4px;
    gap: 8px;
  }

  .content-cover {
    grid-area: media;
    order: 1;
    margin: 0;
    aspect-ratio: 1;
    min-width: 40px;
    height: 100%;
  }

  .context-info {
    grid-area: contextinfo;
    order: 2;
    display: flex !important;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    min-width: 0;
    line-height: 1.1;
    overflow: hidden;
  }

  .context-info__title { font-size: 16px; }
  .context-info__sub { font-size: 12px; }

  .controls {
    grid-area: controls;
    order: 3;
    background: transparent;
    border-radius: 0;
    padding: 0 4px;
    justify-content: flex-end;
    flex-shrink: 0;
    gap: 2px;
  }
}
</style>
