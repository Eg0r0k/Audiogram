<script setup lang="ts">
import { DialogOverlay, type DialogOverlayProps } from "@kappa-ui/core/dialog";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<DialogOverlayProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DialogOverlay
    v-bind="delegated"
    data-slot="dialog-overlay"
    :class="
      cn(
        `
          fixed inset-0 bg-scrim animate-overlay [--overlay-scale:1] transition-[background-color] duration-short-4
          ease-standard
          motion-reduce:transition-none
          has-[~[data-slot=dialog-overlay][data-state=open]]:bg-transparent
          has-[~[data-slot=drawer-overlay][data-state=open]]:bg-transparent
          z-50
        `,
        props.class,
      )
    "
  >
    <slot />
  </DialogOverlay>
</template>
