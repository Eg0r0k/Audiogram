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
      class="size-12 rounded-full shadow-lg"
    >
      <IconPlusTrack class="size-6" />
    </Button>
  </Motion>
</template>

<script setup lang="ts">
import { Motion } from "motion-v";
import { Button } from "@/components/ui/button";

import IconPlusTrack from "~icons/tabler/music-plus";

defineProps<{
  show: boolean;
}>();
</script>
