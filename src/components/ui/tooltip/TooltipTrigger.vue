<script setup lang="ts">
import { TooltipTrigger, type TooltipTriggerProps } from "@kappa-ui/core/tooltip";

const props = defineProps<TooltipTriggerProps>();
</script>

<template>
  <TooltipTrigger
    v-bind="props"
    data-slot="tooltip-trigger"
  >
    <slot />
  </TooltipTrigger>
</template>
