<script setup lang="ts">
import { DrawerMenuSub, type DrawerMenuSubEmits, type DrawerMenuSubProps } from "@kappa-ui/core/drawer-menu";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<DrawerMenuSubProps>();
const emits = defineEmits<DrawerMenuSubEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DrawerMenuSub
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DrawerMenuSub>
</template>
