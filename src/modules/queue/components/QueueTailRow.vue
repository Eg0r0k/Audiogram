<template>
  <div
    v-if="kind === 'autoplay'"
    class="flex h-16 items-center gap-3 px-2.5"
  >
    <div class="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
      <IconSparkles class="size-5 text-muted-foreground" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-base font-medium">
        {{ $t('player.similarTracks') }}
      </p>
      <p class="truncate text-sm text-muted-foreground">
        {{ $t('player.autoplayAddsSimilar') }}
      </p>
    </div>
  </div>
  <div
    v-else
    class="flex h-16 items-center gap-3 px-2.5"
  >
    <div class="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
      <IconPlaylistX class="size-5 text-muted-foreground" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-base font-medium">
        {{ $t('player.lastInQueue') }}
      </p>
      <p class="truncate text-sm text-muted-foreground">
        {{ $t('player.playbackStopsAfter') }}
      </p>
    </div>
    <Button
      v-if="!queueStore.isRadio"
      variant="solid"
      color="card"
      size="sm"
      class="shrink-0"
      @click="repeatQueue"
    >
      <IconRepeat />
      {{ $t('player.repeatQueue') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import IconPlaylistX from "~icons/tabler/playlist-x";
import IconRepeat from "~icons/tabler/repeat";
import IconSparkles from "~icons/tabler/sparkles";
import { useQueueStore } from "../store/queue.store";

defineProps<{
  kind: "autoplay" | "end";
}>();

const queueStore = useQueueStore();

const repeatQueue = () => {
  queueStore.repeatMode = "all";
};
</script>
