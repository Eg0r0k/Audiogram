<script setup lang="ts">
import { DrawerMenuLabel, type DrawerMenuLabelProps } from "@kappa-ui/core/drawer-menu";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { drawerMenuLabel } from ".";

const props = defineProps<DrawerMenuLabelProps & { inset?: boolean; class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, inset: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerMenuLabel
    v-bind="delegated"
    data-slot="drawer-menu-label"
    :data-inset="props.inset || undefined"
    :class="cn(drawerMenuLabel, props.class)"
  >
    <slot />
  </DrawerMenuLabel>
</template>
