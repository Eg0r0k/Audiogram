<script setup lang="ts">
import { SwipeActions, type SwipeActionsProps } from "@kappa-ui/core/swipe-actions";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<SwipeActionsProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SwipeActions
    v-bind="delegated"
    data-slot="swipe-actions"
    :class="cn(props.class)"
  >
    <slot />
  </SwipeActions>
</template>
