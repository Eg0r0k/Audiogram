<template>
  <Motion
    :initial="{ opacity: 0, scale: 0.5, y: 100 }"
    :animate="{
      opacity: show ? 1 : 0,
      scale: show ? 1 : 0.7,
      y: show ? 0 : 80,
      pointerEvents: show ? 'auto' : 'none'
    }"
    :transition="{
      type: 'spring',
      stiffness: 300,
      damping: 25
    }"
    class="absolute bottom-4 right-4 z-50"
  >
    <Button
      class="relative size-12 rounded-full shadow-lg"
    >
      <span
        v-if="count > 0"
        class="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-secondary px-[7px] min-w-5 h-5 py-0.5 text-[14px] font-medium leading-none text-secondary-foreground"
      >
        {{ formatCountWithCap(count) }}
      </span>
      <IconPlusTrack class="size-6" />
    </Button>
  </Motion>
</template>

<script setup lang="ts">
import { Motion } from "motion-v";
import { Button } from "@/components/ui/button";

import IconPlusTrack from "~icons/tabler/music-plus";
import { formatCountWithCap } from "@/lib/math";

defineProps<{
  count: number;
  show: boolean;
}>();
</script>
