<script setup lang="ts">
import {
  MenuCheckboxItem,
  type MenuCheckboxItemEmits,
  type MenuCheckboxItemProps,
  MenuItemIndicator,
} from "@kappa-ui/core/menu";
import IconCheck from "~icons/tabler/check";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { menuIndicator, menuIndicatorItem } from ".";

const props = defineProps<MenuCheckboxItemProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<MenuCheckboxItemEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <MenuCheckboxItem
    v-ripple
    v-bind="forwarded"
    data-slot="menu-checkbox-item"
    :class="cn(menuIndicatorItem, props.class)"
  >
    <span :class="menuIndicator">
      <MenuItemIndicator
        data-slot="menu-item-indicator"
        class="flex items-center justify-center"
      >
        <slot name="indicator-icon">
          <IconCheck stroke-width="2.5" />
        </slot>
      </MenuItemIndicator>
    </span>
    <slot />
  </MenuCheckboxItem>
</template>
