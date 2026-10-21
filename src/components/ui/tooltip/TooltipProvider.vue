<script setup lang="ts">
import { TooltipProvider, type TooltipProviderProps } from "@kappa-ui/core/tooltip";
import { useForwardProps } from "reka-ui";

const props = defineProps<TooltipProviderProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <TooltipProvider v-bind="forwarded">
    <slot />
  </TooltipProvider>
</template>
