<script setup lang="ts">
import { TooltipRoot, type TooltipRootEmits, type TooltipRootProps } from "@kappa-ui/core/tooltip";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<TooltipRootProps>();
const emits = defineEmits<TooltipRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <TooltipRoot
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </TooltipRoot>
</template>
