<script setup lang="ts">
import { DrawerMenu, type DrawerMenuProps } from "@kappa-ui/core/drawer-menu";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { type DrawerMenuSize, drawerMenuVariants } from ".";

const props = withDefaults(
  defineProps<DrawerMenuProps & { size?: DrawerMenuSize; class?: HTMLAttributes["class"] }>(),
  { size: "md" },
);

const delegated = computed(() => {
  const { class: _, size: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerMenu
    v-bind="delegated"
    data-slot="drawer-menu"
    :data-size="props.size"
    :class="cn(drawerMenuVariants({ size: props.size }), props.class)"
  >
    <slot />
  </DrawerMenu>
</template>
