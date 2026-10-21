<script setup lang="ts">
import {
  DrawerMenuRadioGroup,
  type DrawerMenuRadioGroupEmits,
  type DrawerMenuRadioGroupProps,
} from "@kappa-ui/core/drawer-menu";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<DrawerMenuRadioGroupProps>();
const emits = defineEmits<DrawerMenuRadioGroupEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DrawerMenuRadioGroup
    v-bind="forwarded"
    data-slot="drawer-menu-radio-group"
    class="flex flex-col gap-0.5"
  >
    <slot />
  </DrawerMenuRadioGroup>
</template>
