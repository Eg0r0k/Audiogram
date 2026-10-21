<script setup lang="ts">
import {
  SwipeItem,
  type SwipeItemEmits,
  type SwipeItemProps,
  type SwipeSide,
  type SwipeState,
} from "@kappa-ui/core/swipe-actions";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, useTemplateRef } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<SwipeItemProps & { state?: SwipeState; class?: HTMLAttributes["class"] }>();
const emits = defineEmits<SwipeItemEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const item = useTemplateRef<{ open: (side: SwipeSide) => void; close: () => void }>("item");

defineExpose({
  open: (side: SwipeSide) => item.value?.open(side),
  close: () => item.value?.close(),
});
</script>

<template>
  <SwipeItem
    ref="item"
    v-bind="forwarded"
    data-slot="swipe-item"
    :class="cn('swipe-item', props.class)"
  >
    <slot />
  </SwipeItem>
</template>
