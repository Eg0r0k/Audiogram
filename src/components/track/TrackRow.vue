<template>
  <div
    v-ripple
    role="button"
    tabindex="0"
    class="track-row flex rounded select-none items-center gap-3 px-4 h-16 hover:bg-muted/50 cursor-pointer"
    @click="handlePlay"
    @keypress="handlePlay"
    @contextmenu="onContextMenu"
  >
    <span class="w-8 text-center text-muted-foreground">
      {{ index }}
    </span>

    <Image
      :src="track.cover"
      :alt="track.title"
      container-class="size-10 shrink-0 rounded z-1"
      image-class="size-full object-cover"
    />

    <div class="flex-1 min-w-0">
      <div class="font-medium truncate">
        {{ track.title }}
      </div>
      <div class="text-sm text-muted-foreground truncate">
        {{ track.artist }}
      </div>
    </div>

    <span class="text-sm text-muted-foreground">
      {{ formatDuration(track.duration) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import Image from "@/components/ui/image/Image.vue";
import type { Track } from "@/types/track/track";
import { formatDuration } from "@/helpers/formatter/time";
import { useTrackMenu } from "@/composables/useTrackMenu";

interface Props {
  track: Track;
  index?: number;
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
});

const emit = defineEmits<{
  play: [track: Track];
}>();

const { openMenu } = useTrackMenu();

const handlePlay = () => {
  emit("play", props.track);
};

const onContextMenu = () => {
  openMenu(props.track, props.index);
};
</script>
