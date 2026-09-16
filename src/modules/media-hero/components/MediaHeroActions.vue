<template>
  <div class="@container flex flex-col items-center gap-4 @md:flex-row @md:items-center @md:justify-between">
    <div class="flex shrink-0 items-center justify-center gap-4 @md:justify-start">
      <Button
        class="size-14 rounded-full "
        :disabled="showLoadingIndicator || !props.hasTracks"
        @click="handlePlay"
      >
        <IconPause
          v-if="showPauseIcon"
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

      <Button
        v-if="props.like"
        class="rounded-full text-white"
        size="icon-lg"
        variant="ghost"
        :class="{ 'text-primary': props.like.isLiked }"
        :disabled="props.like.isPending"
        :aria-label="props.like.isLiked ? $t('media.unlike') : $t('media.like')"
        @click="props.like.toggle()"
      >
        <IconLikedFilled
          v-if="props.like.isLiked"
          class="size-5"
        />
        <IconLike
          v-else
          class="size-5"
        />
      </Button>

      <MediaDropdown
        v-if="props.showMenu !== false"
        :context="contextType"
        :is-playlist-owner="props.isPlaylistOwner"
      />

      <slot name="after-primary" />
    </div>

    <div class="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 @md:justify-end">
      <InputGroup
        v-if="props.filterable"
        class="h-9 min-w-32 max-w-56 flex-1 rounded-full border-0 bg-black/30 text-white shadow-none"
      >
        <InputGroupAddon tabindex="-1">
          <IconSearch class="size-5 text-white/70" />
        </InputGroupAddon>

        <InputGroupInput
          v-model="filter"
          class="pl-2! text-sm! text-white placeholder:text-white/60"
          :placeholder="$t('media.filter')"
          @keydown.stop
          @keydown.esc="filter = ''"
        />

        <InputGroupAddon
          v-if="filter"
          tabindex="-1"
          align="inline-end"
        >
          <Button
            class="rounded-full text-white hover:text-white"
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('media.filterClear')"
            @click="filter = ''"
          >
            <IconX class="size-4" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaDropdown from "./menu/dropdown/MediaDropdown.vue";
import IconPlay from "~icons/audiogram/play-rounded";
import IconPause from "~icons/audiogram/pause-rounded";
import IconShuffle from "~icons/tabler/arrows-shuffle";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import type { QueueSource } from "@/modules/queue/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { getLogger } from "@/lib/logger";
import { usePlaybackState } from "@/modules/player/composables/usePlaybackState";
import type { MediaType } from "@/types/media-data";
import type { EntityLikeState } from "@/modules/sources/composables/useEntityLike";
import { Button } from "@/components/ui/button";
import { useQueueStore } from "@/modules/queue/store/queue.store";

const props = defineProps<{
  type: MediaType;
  source: QueueSource;
  hasTracks?: boolean;
  isPlaylistOwner?: boolean;
  /** False hides the "⋯" dropdown — its context would render no items. */
  showMenu?: boolean;
  /** Shows the track filter input; the page reads it through the `filter` model. */
  filterable?: boolean;
  /** The entity's like at its source; absent = the source keeps no such likes (or this is a library row). */
  like?: EntityLikeState;
}>();

const emit = defineEmits<{
  play: [];
  shuffle: [];
}>();

const filter = defineModel<string>("filter", { default: "" });

const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const { isActiveSource, isPlaying, isLoading, showLoadingIndicator } = usePlaybackState(() => props.source);
const showPauseIcon = computed(() => isActiveSource.value && (isPlaying.value || isLoading.value));

function handlePlay() {
  if (isActiveSource.value) {
    playerStore.togglePlay()
      .catch(error => getLogger().error(`[Player] Toggling playback failed: ${String(error)}`));
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
