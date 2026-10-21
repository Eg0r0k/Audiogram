<script setup lang="ts">
import { DrawerHandle, useDrawerContext } from "@kappa-ui/core/drawer";
import type { PrimitiveProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { drawerHandleVariants } from ".";

const props = defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>();
const context = useDrawerContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerHandle
    v-bind="delegated"
    data-slot="drawer-handle"
    :class="cn(drawerHandleVariants({ side: context.side.value }), props.class)"
  >
    <slot />
  </DrawerHandle>
</template>
