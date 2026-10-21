<script setup lang="ts">
import { MenuSubTrigger, type MenuSubTriggerProps } from "@kappa-ui/core/menu";
import IconChevronRight from "~icons/tabler/chevron-right";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { menuSubTrigger } from ".";

const props = defineProps<MenuSubTriggerProps & { inset?: boolean; class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, inset: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <MenuSubTrigger
    v-ripple
    v-bind="delegated"
    data-slot="menu-sub-trigger"
    :data-inset="props.inset || undefined"
    :class="cn(menuSubTrigger, props.class)"
  >
    <slot />
    <IconChevronRight class="ms-auto text-muted-foreground rtl:rotate-180" />
  </MenuSubTrigger>
</template>
