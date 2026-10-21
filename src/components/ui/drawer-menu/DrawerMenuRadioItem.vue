<script setup lang="ts">
import {
  DrawerMenuItemIndicator,
  DrawerMenuRadioItem,
  type DrawerMenuRadioItemEmits,
  type DrawerMenuRadioItemProps,
} from "@kappa-ui/core/drawer-menu";
import { useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { drawerMenuIndicator, drawerMenuIndicatorItem, drawerMenuRadioDot } from ".";

const props = defineProps<DrawerMenuRadioItemProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<DrawerMenuRadioItemEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <DrawerMenuRadioItem
    v-ripple
    v-bind="forwarded"
    data-slot="drawer-menu-radio-item"
    :class="cn(drawerMenuIndicatorItem, props.class)"
  >
    <span :class="drawerMenuIndicator">
      <DrawerMenuItemIndicator
        data-slot="drawer-menu-item-indicator"
        class="flex items-center justify-center"
      >
        <slot name="indicator-icon">
          <span :class="drawerMenuRadioDot" />
        </slot>
      </DrawerMenuItemIndicator>
    </span>
    <slot />
  </DrawerMenuRadioItem>
</template>
