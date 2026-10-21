<script setup lang="ts">
import { DrawerMenuSeparator, type DrawerMenuSeparatorProps } from "@kappa-ui/core/drawer-menu";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { drawerMenuSeparator } from ".";

const props = defineProps<DrawerMenuSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerMenuSeparator
    v-bind="delegated"
    data-slot="drawer-menu-separator"
    :class="cn(drawerMenuSeparator, props.class)"
  />
</template>
