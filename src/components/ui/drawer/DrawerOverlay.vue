<script setup lang="ts">
import { type DialogOverlayProps } from "@kappa-ui/core/dialog";
import { DrawerOverlay } from "@kappa-ui/core/drawer";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<DialogOverlayProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerOverlay
    v-bind="delegated"
    data-slot="drawer-overlay"
    :class="
      cn(
        `
          fixed inset-0 z-50 bg-scrim animate-overlay drawer-overlay-fade [--overlay-scale:1]
          motion-reduce:transition-none
          has-[~[data-slot=dialog-overlay][data-state=open]]:bg-transparent
        `,
        props.class,
      )
    "
  >
    <slot />
  </DrawerOverlay>
</template>
