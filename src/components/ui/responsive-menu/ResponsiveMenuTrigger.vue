<script setup lang="ts">
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DrawerTrigger } from "@/components/ui/drawer";
import { useResponsiveMenu } from "./context";

const props = withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const menu = useResponsiveMenu();
</script>

<template>
  <DropdownMenuTrigger
    v-if="menu.mode.value === 'popper'"
    as-child
    :disabled="props.disabled"
  >
    <slot />
  </DropdownMenuTrigger>
  <DrawerTrigger
    v-else
    as-child
    :disabled="props.disabled"
  >
    <slot />
  </DrawerTrigger>
</template>
