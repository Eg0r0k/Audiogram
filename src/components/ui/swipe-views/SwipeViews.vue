<script setup lang="ts">
import { SwipeViewsRoot, type SwipeViewsRootEmits, type SwipeViewsRootProps } from "@kappa-ui/core/swipe-views";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, useTemplateRef } from "vue";

import { cn } from "@/lib/utils";
import { swipeViewsVariants } from ".";

const props = defineProps<SwipeViewsRootProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<SwipeViewsRootEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);

const root = useTemplateRef<{ position: number }>("root");

defineExpose({ position: computed(() => root.value?.position ?? 0) });
</script>

<template>
  <SwipeViewsRoot
    ref="root"
    v-slot="slotProps"
    v-bind="forwarded"
    data-slot="swipe-views"
    :class="cn(swipeViewsVariants({ orientation: props.orientation, layout: props.layout }), props.class)"
  >
    <slot v-bind="slotProps" />
  </SwipeViewsRoot>
</template>
