<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="item-actions"
    :class="cn('flex items-center gap-2 z-1 pointer-events-none', props.class)"
  >
    <slot />
  </div>
</template>
