<script setup lang="ts">
import IconCheck from "~icons/tabler/check";
import {
  ColorSwatchPickerItem,
  ColorSwatchPickerItemIndicator,
  ColorSwatchPickerItemSwatch,
  type ColorSwatchPickerItemProps,
  colorToString,
  parseColor,
} from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { colorPickerSwatch, colorPickerSwatchColor, colorPickerSwatchIndicator } from ".";

const props = defineProps<ColorSwatchPickerItemProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, value: __, ...rest } = props;
  return rest;
});

const hex = computed(() => colorToString(parseColor(props.value), "hex"));
</script>

<template>
  <ColorSwatchPickerItem
    v-bind="delegated"
    data-slot="color-picker-swatch"
    :value="hex"
    :class="cn(colorPickerSwatch, props.class)"
  >
    <ColorSwatchPickerItemSwatch
      data-slot="color-picker-swatch-color"
      :class="colorPickerSwatchColor"
    />
    <ColorSwatchPickerItemIndicator
      data-slot="color-picker-swatch-indicator"
      :class="colorPickerSwatchIndicator"
    >
      <slot><IconCheck /></slot>
    </ColorSwatchPickerItemIndicator>
  </ColorSwatchPickerItem>
</template>
