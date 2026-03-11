<template>
  <Teleport to="body">
    <div
      v-if="isDragging && draggedItem"
      class="fixed z-50 pointer-events-none px-4"
      :style="{
        top: `${ghostY - 28}px`,
        left: `${containerLeft}px`,
        width: `${containerWidth}px`,
      }"
    >
      <div class="flex items-center gap-3 px-3 py-2 rounded-sm bg-accent opacity-90">
        <IconGripVertical class="size-4 text-muted-foreground shrink-0" />

        <div class="size-10 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          <NuxtImage
            :src="draggedItem.track.cover"
            alt=""
            fallback-src="/img/fallback.svg"
            class="size-full object-cover"
          />
        </div>

        <div class="flex-1 min-w-0">
          <span class="text-sm font-medium truncate block">
            {{ draggedItem.track.title }}
          </span>
          <span class="text-xs text-muted-foreground truncate block">
            {{ draggedItem.track.artist }}
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { QueueItem } from "../types";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconGripVertical from "~icons/tabler/grip-vertical";

defineProps<{
  isDragging: boolean;
  draggedItem: QueueItem | null;
  ghostY: number;
  containerLeft: number;
  containerWidth: number;
}>();
</script>
