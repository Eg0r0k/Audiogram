<script setup lang="ts">
import { MenuSub, type MenuSubEmits, type MenuSubProps } from "@kappa-ui/core/menu";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<MenuSubProps>();
const emits = defineEmits<MenuSubEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <MenuSub
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </MenuSub>
</template>
