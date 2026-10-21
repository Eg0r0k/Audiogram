<script setup lang="ts">
import { SwipeView, type SwipeViewProps, useSwipeViewsContext } from "@kappa-ui/core/swipe-views";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { swipeViewVariants } from ".";

const props = defineProps<SwipeViewProps & { class?: HTMLAttributes["class"] }>();
const context = useSwipeViewsContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SwipeView
    v-slot="slotProps"
    v-bind="delegated"
    data-slot="swipe-view"
    :class="
      cn(swipeViewVariants({ orientation: context.orientation.value, layout: context.layout.value }), props.class)
    "
  >
    <slot v-bind="slotProps" />
  </SwipeView>
</template>
