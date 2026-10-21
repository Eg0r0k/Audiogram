<script setup lang="ts">
import {
  MenuItemIndicator,
  MenuRadioItem,
  type MenuRadioItemEmits,
  type MenuRadioItemProps,
} from "@kappa-ui/core/menu";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { menuIndicator, menuIndicatorItem, menuRadioDot } from ".";

const props = defineProps<MenuRadioItemProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<MenuRadioItemEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <MenuRadioItem
    v-ripple
    v-bind="forwarded"
    data-slot="menu-radio-item"
    :class="cn(menuIndicatorItem, props.class)"
  >
    <span :class="menuIndicator">
      <MenuItemIndicator
        data-slot="menu-item-indicator"
        class="flex items-center justify-center"
      >
        <slot name="indicator-icon">
          <span :class="menuRadioDot" />
        </slot>
      </MenuItemIndicator>
    </span>
    <slot />
  </MenuRadioItem>
</template>
