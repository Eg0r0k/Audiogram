<script setup lang="ts">
import { SwipeRoot } from "@kappa-ui/core/swipe-actions";
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
  <SwipeRoot
    v-bind="delegated"
    data-slot="swipe-root"
    :class="cn(props.class)"
  >
    <slot />
  </SwipeRoot>
</template>
