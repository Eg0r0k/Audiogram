<!--
  Adapted from React Swipe Actions (https://github.com/ncdai/react-primitives), modified for kappa-ui.
  Copyright (c) 2025 ncdai. MIT License: https://github.com/ncdai/react-primitives/blob/main/packages/react-swipe-actions/LICENSE
-->
<script setup lang="ts">
import { SwipeAction, SwipeActionContent, type SwipeActionProps } from "@kappa-ui/core/swipe-actions";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import type { SwipeActionColor } from ".";

const props = withDefaults(
  defineProps<SwipeActionProps & { color?: SwipeActionColor | (string & {}); class?: HTMLAttributes["class"] }>(),
  { color: "primary", closeOnClick: true },
);

const delegated = computed(() => {
  const { class: _, color: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <SwipeAction
    v-bind="delegated"
    data-slot="swipe-action"
    :data-color="props.color"
    :class="
      cn(
        'group/swipe-action bg-tone text-tone-foreground outline-none select-none data-armed:brightness-90',
        props.class,
      )
    "
  >
    <SwipeActionContent
      data-slot="swipe-action-content"
      class="min-w-20 flex-col items-center justify-center gap-1 px-4 text-label-sm icon-size-5 group-focus-visible/swipe-action:focus-ring-inset"
    >
      <slot />
    </SwipeActionContent>
  </SwipeAction>
</template>
