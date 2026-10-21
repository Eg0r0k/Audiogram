<script setup lang="ts">
import { SwipeContent } from "@kappa-ui/core/swipe-actions";
import type { PrimitiveProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SwipeContent
    v-bind="delegated"
    data-slot="swipe-content"
    :class="cn('bg-background data-dragging:cursor-grabbing', props.class)"
  >
    <slot />
  </SwipeContent>
</template>
