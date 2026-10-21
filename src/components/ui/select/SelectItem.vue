<script setup lang="ts">
import IconCheck from "~icons/tabler/check";
import {
  SelectItem,
  type SelectItemEmits,
  SelectItemIndicator,
  type SelectItemProps,
  useForwardPropsEmits,
} from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { menuItem } from "@/components/ui/menu";
import SelectItemText from "./SelectItemText.vue";

const props = defineProps<SelectItemProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<SelectItemEmits>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <SelectItem
    v-ripple
    v-bind="forwarded"
    data-slot="select-item"
    :class="
      cn(
        menuItem,
        `
          w-full font-normal pe-[calc(var(--menu-item-px)+var(--menu-icon)+var(--menu-item-gap))]
          data-[state=checked]:bg-primary/(--state-selected)
        `,
        props.class,
      )
    "
  >
    <span
      class="pointer-events-none absolute end-(--menu-item-px) flex size-(--menu-icon) items-center justify-center text-primary group-data-disabled/menu-item:text-foreground/(--disabled-opacity)"
    >
      <SelectItemIndicator
        data-slot="select-item-indicator"
        class="flex items-center justify-center"
      >
        <slot name="indicator-icon">
          <IconCheck stroke-width="2.5" />
        </slot>
      </SelectItemIndicator>
    </span>
    <SelectItemText>
      <slot />
    </SelectItemText>
  </SelectItem>
</template>
