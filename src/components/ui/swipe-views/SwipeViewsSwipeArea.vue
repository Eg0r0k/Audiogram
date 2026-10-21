<script setup lang="ts">
import { SwipeViewsSwipeArea, type SwipeViewsSwipeAreaProps, useSwipeViewsContext } from "@kappa-ui/core/swipe-views";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { swipeViewsSwipeAreaVariants } from ".";

const props = defineProps<SwipeViewsSwipeAreaProps & { class?: HTMLAttributes["class"] }>();
const context = useSwipeViewsContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SwipeViewsSwipeArea
    v-bind="delegated"
    data-slot="swipe-views-swipe-area"
    :class="cn(swipeViewsSwipeAreaVariants({ orientation: context.orientation.value, side: props.side }), props.class)"
  >
    <slot />
  </SwipeViewsSwipeArea>
</template>
