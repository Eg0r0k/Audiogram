<script setup lang="ts">
import IconCheck from "~icons/tabler/check";
import {
  DrawerMenuCheckboxItem,
  type DrawerMenuCheckboxItemEmits,
  type DrawerMenuCheckboxItemProps,
  DrawerMenuItemIndicator,
} from "@kappa-ui/core/drawer-menu";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { drawerMenuIndicator, drawerMenuIndicatorItem } from ".";

const props = defineProps<DrawerMenuCheckboxItemProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<DrawerMenuCheckboxItemEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <DrawerMenuCheckboxItem
    v-ripple
    v-bind="forwarded"
    data-slot="drawer-menu-checkbox-item"
    :class="cn(drawerMenuIndicatorItem, props.class)"
  >
    <span :class="drawerMenuIndicator">
      <DrawerMenuItemIndicator
        data-slot="drawer-menu-item-indicator"
        class="flex items-center justify-center"
      >
        <slot name="indicator-icon">
          <IconCheck stroke-width="2.5" />
        </slot>
      </DrawerMenuItemIndicator>
    </span>
    <slot />
  </DrawerMenuCheckboxItem>
</template>
