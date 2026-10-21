<script setup lang="ts">
import { MenuSeparator, type MenuSeparatorProps } from "@kappa-ui/core/menu";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { menuSeparator } from ".";

const props = defineProps<MenuSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <MenuSeparator
    v-bind="delegated"
    data-slot="menu-separator"
    :class="cn(menuSeparator, props.class)"
  />
</template>
