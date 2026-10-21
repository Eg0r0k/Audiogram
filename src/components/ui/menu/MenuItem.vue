<script setup lang="ts">
import { MenuItem, type MenuItemEmits, type MenuItemProps } from "@kappa-ui/core/menu";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { type MenuItemColor, menuItem } from ".";

const props = defineProps<
  MenuItemProps & {
    inset?: boolean;
    color?: MenuItemColor | (string & {});
    class?: HTMLAttributes["class"];
  }
>();
const emits = defineEmits<MenuItemEmits>();

const delegated = computed(() => {
  const { class: _, inset: __, color: ___, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <MenuItem
    v-ripple
    v-bind="forwarded"
    data-slot="menu-item"
    :data-inset="props.inset || undefined"
    :data-color="props.color"
    :class="cn(menuItem, props.class)"
  >
    <slot />
  </MenuItem>
</template>
