<template>
  <div class="flex p-6 gap-4 items-center justify-between">
    <div class="flex items-center gap-4">
      <PlayButton
        class="size-14"
        @click="emit('play')"
      />
      <Button
        v-if="showShuffle"
        class="rounded-full"
        size="icon-lg"
        variant="ghost"
        @click="emit('shuffle')"
      >
        <Icon
          class="size-5"
          icon="tabler:arrows-shuffle"
        />
      </Button>

      <MediaDropdown :context="contextType" />
    </div>
    <MediaDisplayDropdown />
  </div>
</template>

<script setup lang="ts">
import PlayButton from "@/components/player/PlayButton.vue";
import MediaDropdown from "@/components/media-hero/dropdown/MediaDropdown.vue";
import MediaDisplayDropdown from "@/components/media-hero/MediaDisplayDropdown.vue";
import Button from "../ui/button/Button.vue";
import { MediaType } from "./types";
import { computed } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  type: MediaType;
}>();
const emit = defineEmits<{
  play: [];
  shuffle: [];
}>();

const contextType = computed(() => {
  switch (props.type) {
    case "artist":
      return "artist-page";
    case "liked":
      return "liked";
    case "playlist":
      return "playlist";
    case "album":
      return "album";
    default:
      return "album";
  }
});

const showShuffle = computed(() =>
  props.type !== "artist",
);

</script>
