<template>
  <Scrollable class="flex-1 relative">
    <div
      class="flex  items-center w-full justify-between fixed top-0 z-10 transition-shadow duration-200 py-4 pl-6 pr-4"
    >
      <div class="flex flex-col">
        <span class=" font-bold text-lg">
          {{ title }}
        </span>
        <span class="  font-medium text-muted-foreground ">
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

    <div class="flex w-full justify-center items-center h-screen">
      <NuxtImage
        :src="cover"
        fallback-src="/img/fallback.svg"
        :alt="title"
        class="object-contain max-h-full h-[57vh] w-auto rounded-2xl"
      />
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { usePlayerStore } from "../store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";

import { Button } from "@/components/ui/button";

import IconX from "~icons/tabler/x";
import { Scrollable } from "@/components/ui/scrollable";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";

import { useImageColor } from "@/composables/useImageColor";

const emit = defineEmits<{
  close: [];
}>();

const player = usePlayerStore();
const queue = useQueueStore();

const title = computed(() => player.currentTrack?.title);
const cover = computed(() => player.currentTrack?.cover);

const { color, extractColor } = useImageColor();

watch(
  cover,
  async (newCover) => {
    if (newCover) {
      await extractColor(newCover);
    }
  },
  { immediate: true },
);
</script>
