<template>
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <Button
        class="size-14 rounded-full "
        :disabled="isLoading"
        @click="handlePlay"
      >
        <IconPause
          v-if="isPlaying"
          class="size-5 fill-current"
        />
        <IconPlay
          v-else
          class="size-5 fill-current"
        />
      </Button>

      <Button
        class="rounded-full text-white"
        size="icon-lg"
        variant="ghost"
        :class="{ 'text-primary': isShuffleActive }"
        @click="emit('shuffle')"
      >
        <IconShuffle class="size-5" />
      </Button>

      <MediaDropdown
        :context="contextType"
        :is-playlist-owner="props.isPlaylistOwner"
      />

      <slot name="after-primary" />
    </div>

    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaDropdown from "./menu/dropdown/MediaDropdown.vue";
import IconPlay from "~icons/tabler/player-play-filled";
import IconPause from "~icons/tabler/player-pause-filled";
import IconShuffle from "~icons/tabler/arrows-shuffle";
import type { QueueSource } from "@/modules/queue/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { usePlaybackState } from "@/modules/player/composables/usePlaybackState";
import { MediaType } from "@/modules/media-hero/types";
import { Button } from "@/components/ui/button";
import { useQueueStore } from "@/modules/queue/store/queue.store";

const props = defineProps<{
  type: MediaType;
  source: QueueSource;
  isPlaylistOwner?: boolean;
}>();

const emit = defineEmits<{
  play: [];
  shuffle: [];
}>();

const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const { isActiveSource, isPlaying, isLoading } = usePlaybackState(() => props.source);

function handlePlay() {
  if (isActiveSource.value) {
    playerStore.togglePlay();
  }
  else {
    emit("play");
  }
}

const contextType = computed(() => {
  switch (props.type) {
    case "artist": return "artist-page";
    case "liked": return "liked";
    case "playlist": return "playlist";
    case "album": return "album";
    default: return "album";
  }
});

const isShuffleActive = computed(() => isActiveSource.value && queueStore.isShuffled);
</script>
