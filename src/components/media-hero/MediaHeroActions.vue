<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Button
        class="size-14 rounded-full"
        @click="emit('play')"
      >
        <IconPlay class="size-5" />
      </Button>

      <Button
        v-if="showShuffle"
        class="rounded-full"
        size="icon-lg"
        variant="ghost"
        @click="emit('shuffle')"
      >
        <IconShuffle class="size-5" />
      </Button>

      <MediaDropdown :context="contextType" />
    </div>

    <MediaDisplayDropdown />
  </div>
</template>

<script setup lang="ts">
import Button from "../ui/button/Button.vue";
import { MediaType } from "./types";
import { computed } from "vue";
import MediaDropdown from "./menu/dropdown/MediaDropdown.vue";
import IconShuffle from "~icons/tabler/arrows-shuffle";
import IconPlay from "~icons/tabler/player-play-filled";
import MediaDisplayDropdown from "./MediaDisplayDropdown.vue";

const props = defineProps<{
  type: MediaType;
}>();
const emit = defineEmits<{
  play: [];
  shuffle: [];
}>();

const contextType = computed(() => {
  switch (props.type) {
    case "artist": return "artist-page";
    case "liked": return "liked";
    case "playlist": return "playlist";
    case "album": return "album";
    default: return "album";
  }
});

const showShuffle = computed(() => props.type !== "artist");
</script>
