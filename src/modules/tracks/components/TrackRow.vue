<template>
  <div
    v-ripple
    role="button"
    tabindex="0"
    :data-compact="compact"
    :class="styles.root"
    @click="handlePlay"
    @keypress="handlePlay"
    @contextmenu="onContextMenu"
  >
    <span :class="styles.index">
      {{ index }}
    </span>

    <NuxtImage
      :src="track.cover"
      :alt="track.title"
      :class="styles.image"
    />

    <div :class="styles.info">
      <div :class="styles.title">
        {{ track.title }}
      </div>
      <div :class="styles.artist">
        {{ track.artist }}
      </div>
    </div>

    <Button
      variant="ghost"
      size="icon-sm"
      class="rounded-full"
      @click.stop="toggle"
    >
      <Like
        ref="likeRef"
        class="text-xl"
        :is-liked="liked"
      />
    </Button>

    <Button
      variant="ghost"
      size="icon-sm"
      class="rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      @click.stop="onDotsClick"
    >
      <IconDots
        class="size-4"
      />
    </Button>

    <span :class="styles.duration">
      {{ formatDuration(track.duration) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cva } from "class-variance-authority";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { ref, useTemplateRef } from "vue";
import IconDots from "~icons/tabler/dots";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { formatDuration } from "@/lib/format/time";
import type { Track } from "@/modules/player/types";
import Like from "@/modules/player/components/actions/Like.vue";
import { Button } from "@/components/ui/button";

interface Props {
  track: Track;
  index?: number;
  compact?: boolean;
}

const likeRef = useTemplateRef("likeRef");
const liked = ref(false);

const toggle = () => {
  if (!liked.value) {
    likeRef.value?.playAnimation();
  }
  liked.value = !liked.value;
};

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  compact: false,
});

const emit = defineEmits<{
  play: [track: Track];
}>();

const styles = {
  root: cva([
    "group track-row flex rounded select-none items-center gap-3 px-4 w-full cursor-pointer hover:bg-muted/50",
    "h-16 data-[compact=true]:h-8",
    "focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none focus-visible:border-ring",
  ])(),
  index: "text-center text-muted-foreground font-mono w-8 text-base group-data-[compact=true]:w-6 group-data-[compact=true]:text-xs",
  image: "shrink-0 rounded z-1 size-10 group-data-[compact=true]:hidden",
  info: "flex-1 min-w-0 flex flex-col group-data-[compact=true]:flex-row group-data-[compact=true]:items-baseline group-data-[compact=true]:gap-2",
  title: "font-medium truncate text-base group-data-[compact=true]:text-sm",
  artist: "flex items-center text-muted-foreground truncate text-sm group-data-[compact=true]:text-xs",
  duration: "text-muted-foreground ml-auto text-sm group-data-[compact=true]:text-xs",
};

const { openMenu, openDropdown } = useTrackMenu();

const handlePlay = () => {
  emit("play", props.track);
};

const onContextMenu = () => {
  openMenu(props.track, props.index);
};

const onDotsClick = (event: MouseEvent) => {
  openDropdown(props.track, props.index, event);
};
</script>
