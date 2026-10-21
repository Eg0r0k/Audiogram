<script setup lang="ts">
import IconChevronRight from "~icons/tabler/chevron-right";
import { DrawerMenuSubTrigger, type DrawerMenuItemProps } from "@kappa-ui/core/drawer-menu";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { drawerMenuItem } from ".";

const props = defineProps<DrawerMenuItemProps & { inset?: boolean; class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, inset: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <DrawerMenuSubTrigger
    v-ripple
    v-bind="delegated"
    data-slot="drawer-menu-sub-trigger"
    :data-inset="props.inset || undefined"
    :class="cn(drawerMenuItem, props.class)"
  >
    <slot />
    <IconChevronRight class="ms-auto text-muted-foreground rtl:rotate-180" />
  </DrawerMenuSubTrigger>
</template>
