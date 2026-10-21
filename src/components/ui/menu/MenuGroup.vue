<script setup lang="ts">
import { MenuGroup, type MenuGroupProps } from "@kappa-ui/core/menu";

const props = defineProps<MenuGroupProps>();
</script>

<template>
  <MenuGroup
    v-bind="props"
    data-slot="menu-group"
    class="flex flex-col"
  >
    <slot />
  </MenuGroup>
</template>
