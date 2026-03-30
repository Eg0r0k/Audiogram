<template>
  <Scrollable class="h-screen w-full">
    <section class="min-h-screen bg-background text-foreground">
      <div class="sticky top-0 z-10 flex items-center justify-between bg-background/70 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-lg font-bold sm:text-xl">
            {{ title }}
          </span>
          <span class="truncate text-sm font-medium text-muted-foreground sm:text-base">
            {{ player.currentTrack?.artist }}
          </span>
        </div>

        <Button
          class="rounded-full"
          size="icon-lg"
          variant="ghost"
          @click="emit('close')"
        >
          <IconX class="size-6" />
        </Button>
      </div>

      <div class="mx-auto flex max-w-5xl flex-col items-center px-4 pb-14 pt-6 sm:px-6 lg:px-10">
        <CurrentTrackLyrics />
      </div>
    </section>
  </Scrollable>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "../store/player.store";

import { Button } from "@/components/ui/button";

import IconX from "~icons/tabler/x";
import { Scrollable } from "@/components/ui/scrollable";
import CurrentTrackLyrics from "./CurrentTrackLyrics.vue";

const emit = defineEmits<{
  close: [];
}>();

const player = usePlayerStore();

const title = computed(() => player.currentTrack?.title);
</script>
