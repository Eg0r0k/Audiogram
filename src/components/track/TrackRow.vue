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

    <Image
      :src="track.cover"
      :alt="track.title"
      :container-class="styles.image"
      image-class="size-full object-cover"
    />

    <div :class="styles.info">
      <div :class="styles.title">
        {{ track.title }}
      </div>
      <div :class="styles.artist">
        {{ track.artist }}
      </div>
    </div>

    <span :class="styles.duration">
      {{ formatDuration(track.duration) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { cva } from "class-variance-authority";
import Image from "@/components/ui/image/Image.vue";
import type { Track } from "@/types/track/track";
import { formatDuration } from "@/helpers/formatter/time";
import { useTrackMenu } from "@/composables/useTrackMenu";

interface Props {
  track: Track;
  index?: number;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  compact: false,
});

const emit = defineEmits<{
  play: [track: Track];
}>();

const styles = {
  root: cva(
    [
      "group track-row flex rounded select-none items-center gap-3 px-4 w-full cursor-pointer hover:bg-muted/50",
      "h-16 data-[compact=true]:h-8",
    ],
  )(),

  index: "text-center text-muted-foreground font-mono  w-8 text-base group-data-[compact=true]:w-6 group-data-[compact=true]:text-xs",

  image: "shrink-0 rounded z-1  size-10 group-data-[compact=true]:hidden",

  info: "flex-1 min-w-0 flex flex-col  group-data-[compact=true]:flex-row group-data-[compact=true]:items-baseline group-data-[compact=true]:gap-2",

  title: "font-medium truncate text-base group-data-[compact=true]:text-sm",

  artist: "text-muted-foreground truncate text-sm group-data-[compact=true]:text-xs",

  duration: "text-muted-foreground ml-auto text-sm group-data-[compact=true]:text-xs",
};

const { openMenu } = useTrackMenu();

const handlePlay = () => {
  emit("play", props.track);
};

const onContextMenu = () => {
  openMenu(props.track, props.index);
};
</script>
