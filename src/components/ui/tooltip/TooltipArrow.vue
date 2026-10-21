<script setup lang="ts">
import { TooltipArrow, type TooltipArrowProps } from "@kappa-ui/core/tooltip";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<TooltipArrowProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <TooltipArrow
    v-bind="delegated"
    data-slot="tooltip-arrow"
    :class="
      cn('z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-xs bg-foreground fill-foreground', props.class)
    "
  />
</template>
