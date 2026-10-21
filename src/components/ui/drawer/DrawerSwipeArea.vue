<script setup lang="ts">
import { DrawerSwipeArea, useDrawerContext } from "@kappa-ui/core/drawer";
import type { PrimitiveProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { drawerSwipeAreaVariants } from ".";

const props = defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>();
const context = useDrawerContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerSwipeArea
    v-bind="delegated"
    data-slot="drawer-swipe-area"
    :class="cn(drawerSwipeAreaVariants({ side: context.side.value }), props.class)"
  >
    <slot />
  </DrawerSwipeArea>
</template>
