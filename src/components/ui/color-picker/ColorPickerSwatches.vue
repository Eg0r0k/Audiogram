<script setup lang="ts">
import { ColorSwatchPickerRoot, type ColorSwatchPickerRootProps, isValidColor, parseColor } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { colorPickerSwatches, injectColorPickerContext } from ".";

const props = defineProps<
  Omit<ColorSwatchPickerRootProps, "modelValue" | "defaultValue" | "disabled" | "multiple" | "selectionBehavior"> & {
    class?: HTMLAttributes["class"];
  }
>();

const context = injectColorPickerContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});

const select = (value: unknown) => {
  if (typeof value === "string" && isValidColor(value)) context.setColor(parseColor(value));
};
</script>

<template>
  <ColorSwatchPickerRoot
    v-bind="delegated"
    data-slot="color-picker-swatches"
    selection-behavior="replace"
    :model-value="context.hex.value"
    :disabled="context.disabled.value"
    :class="cn(colorPickerSwatches, props.class)"
    @update:model-value="select"
  >
    <slot />
  </ColorSwatchPickerRoot>
</template>
