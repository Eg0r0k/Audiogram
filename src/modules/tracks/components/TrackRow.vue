<template>
  <div
    ref="rowRef"
    v-ripple
    role="button"
    tabindex="0"
    data-track-row
    :data-compact="compact"
    :class="[
      styles.root,
      rowStateClass, dimmed && 'opacity-50',
      beingDragged && 'opacity-30',
    ]"
    @click="handleClick"
    @keypress="handleClick"
    @contextmenu="onContextMenu"
  >
    <button
      v-if="draggable"
      class="shrink-0 w-8 h-full cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none flex items-center justify-center"
      :aria-label="$t('queue.drag')"
      @pointerdown.stop="$emit('dragStart', $event)"
      @click.stop
    >
      <IconGripVertical class="size-4.5" />
    </button>

    <span
      v-else
      :class="styles.index"
    >
      {{ index }}
    </span>

    <div class="relative shrink-0  size-10 group-data-[compact=true]:hidden z-10">
      <NuxtImage
        :src="coverUrl"
        :alt="track.title"
        fallback-src="/img/fallback.svg"
        :class="styles.image"
      />

      <div
        :class="[
          styles.imageOverlay,
          showOverlay ? 'opacity-100' : 'opacity-0',
        ]"
      >
        <span
          v-if="isCurrentTrack && isPlaying && !isRowHovered"
          class="size-2 rounded-full bg-primary"
        />

        <IconPause
          v-else-if="isCurrentTrack && isPlaying && isRowHovered"
          class="size-5 text-white drop-shadow-md"
        />

        <IconPlay
          v-else
          class="size-5 text-white drop-shadow-md"
        />
      </div>
    </div>

    <div :class="styles.info">
      <div
        :class="[styles.title, (highlighted || isCurrentTrack) && 'text-primary']"
      >
        {{ track.title }}
      </div>
      <div :class="styles.artist">
        <template
          v-for="(artist, i) in artists"
          :key="i"
        >
          <span
            role="link"
            tabindex="0"
            class="hover:text-foreground underline-offset-2 transition-colors duration-200 cursor-pointer truncate"
            @click.stop="handleArtistClick"
            @keypress.enter.stop="handleArtistClick"
          >
            {{ artist }}
          </span>
          <span v-if="i < artists.length - 1">,&nbsp;</span>
        </template>
      </div>
    </div>

    <Button
      variant="ghost"
      size="icon-sm"
      :class="[
        'rounded-full transition-colors transition-opacity',
        isLiked
          ? 'opacity-100 text-primary hover:text-primary'
          : 'opacity-0 text-muted-foreground sm:group-hover:opacity-100 hover:text-foreground'
      ]"
      @click.stop="toggle"
    >
      <IconLike :filled="isLiked" />
    </Button>
    <div class="w-7 flex justify-end items-center relative">
      <span :class="styles.duration">
        {{ formatDuration(track.duration) }}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        :class="styles.dots"
        @click.stop="onDotsClick"
      >
        <IconDots class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cva } from "class-variance-authority";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { computed, useTemplateRef } from "vue";
import { useElementHover } from "@vueuse/core";
import IconDots from "~icons/tabler/dots";
import IconGripVertical from "~icons/tabler/grip-vertical";
import IconLike from "~icons/tabler/heart";
import IconPlay from "~icons/tabler/player-play-filled";
import IconPause from "~icons/tabler/player-pause-filled";

import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { formatDuration } from "@/lib/format/time";
import type { Track } from "@/modules/player/types";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useRouter } from "vue-router";
import type { QueueItemId } from "@/types/ids";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";

interface Props {
  track: Track;
  index?: number;
  menuIndex?: number;
  queueItemId?: QueueItemId | null;
  compact?: boolean;
  draggable?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  beingDragged?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  menuIndex: undefined,
  queueItemId: null,
  compact: false,
  draggable: false,
  highlighted: false,
  dimmed: false,
  beingDragged: false,
});

const emit = defineEmits<{
  play: [track: Track];
  dragStart: [event: PointerEvent];
}>();

const playerStore = usePlayerStore();
const route = useRouter();
const { toggleTrackLike } = useToggleTrackLike();

const rowRef = useTemplateRef("rowRef");
const isRowHovered = useElementHover(() => rowRef.value);
const isCurrentTrack = computed(() => playerStore.currentTrack?.id === props.track.id);
const isPlaying = computed(() => playerStore.isPlaying);
const showOverlay = computed(() => isCurrentTrack.value || isRowHovered.value);
const isLiked = computed(() => props.track.isLiked);

const coverUrl = computed(() => "/img/fallback.svg");

const artists = computed(() =>
  props.track.artist
    .split(/,\s*/)
    .map(a => a.trim())
    .filter(Boolean),
);

const styles = {
  root: cva([
    "group track-row flex rounded select-none items-center gap-3 w-full cursor-pointer hover:bg-muted/50 px-2.5",
    "h-16 data-[compact=true]:h-8",
    "focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none focus-visible:border-ring",
  ])(),
  index: "text-center font-semibold text-muted-foreground font-mono w-8 text-base group-data-[compact=true]:w-6 group-data-[compact=true]:text-xs",
  image: "size-full rounded object-cover",
  imageOverlay: [
    "absolute inset-0 rounded flex items-center justify-center",
    "bg-black/50 transition-opacity duration-200 ease-out",
  ].join(" "),
  info: "flex-1 min-w-0 flex flex-col group-data-[compact=true]:flex-row group-data-[compact=true]:items-baseline group-data-[compact=true]:gap-2",
  title: "font-medium truncate text-base group-data-[compact=true]:text-sm hover:underline",
  artist: "flex items-center text-muted-foreground truncate text-sm group-data-[compact=true]:text-xs",
  duration: "text-muted-foreground font-medium text-sm group-data-[compact=true]:text-xs hidden sm:block sm:group-hover:hidden",
  dots: "absolute rounded-full transition-opacity opacity-0 sm:group-hover:opacity-100",
};

const {
  openMenu,
  openDropdown,
  activeTrack,
  isDropdownOpen,
  isContextMenuOpen,
} = useTrackMenu();

const resolvedMenuIndex = computed(() => props.menuIndex ?? props.index);

const isMenuSelected = computed(() => {
  return (isDropdownOpen.value || isContextMenuOpen.value)
    && activeTrack.value?.id === props.track.id;
});

const isActivePlayback = computed(() => props.highlighted || isCurrentTrack.value);

const rowStateClass = computed(() => {
  if (isActivePlayback.value) return "bg-primary/10";
  if (isMenuSelected.value) return "bg-accent/80";
  return "";
});

const handleClick = () => {
  if (isCurrentTrack.value) {
    playerStore.togglePlay();
  }
  else {
    emit("play", props.track);
  }
};

const handleArtistClick = () => {
  route.push({ name: "artist", params: { id: props.track.artistId } });
};

const toggle = async () => {
  await toggleTrackLike(props.track);
};

const onContextMenu = () => {
  openMenu(props.track, resolvedMenuIndex.value, {
    queueItemId: props.queueItemId,
  });
};

const onDotsClick = (event: MouseEvent) => {
  openDropdown(props.track, resolvedMenuIndex.value, event, {
    queueItemId: props.queueItemId,
  });
};
</script>
