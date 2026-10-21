<script setup lang="ts">
import { PopoverAnchor, type PopoverAnchorProps } from "reka-ui";

const props = defineProps<PopoverAnchorProps>();
</script>

<template>
  <PopoverAnchor
    v-bind="props"
    data-slot="popover-anchor"
  >
    <slot />
  </PopoverAnchor>
</template>
