<script setup lang="ts">
import { MenuRadioGroup, type MenuRadioGroupEmits, type MenuRadioGroupProps } from "@kappa-ui/core/menu";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<MenuRadioGroupProps>();
const emits = defineEmits<MenuRadioGroupEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <MenuRadioGroup
    v-bind="forwarded"
    data-slot="menu-radio-group"
    class="flex flex-col"
  >
    <slot />
  </MenuRadioGroup>
</template>
