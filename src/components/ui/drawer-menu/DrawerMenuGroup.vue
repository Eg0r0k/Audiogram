<script setup lang="ts">
import { DrawerMenuGroup, type DrawerMenuGroupProps } from "@kappa-ui/core/drawer-menu";

const props = defineProps<DrawerMenuGroupProps>();
</script>

<template>
  <DrawerMenuGroup
    v-bind="props"
    data-slot="drawer-menu-group"
    class="flex flex-col gap-0.5"
  >
    <slot />
  </DrawerMenuGroup>
</template>
