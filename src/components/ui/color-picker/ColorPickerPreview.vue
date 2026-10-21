<script setup lang="ts">
import { ColorSwatch, type ColorSwatchProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { colorPickerPreview, colorPickerPreviewColor, injectColorPickerContext } from ".";

const props = defineProps<ColorSwatchProps & { class?: HTMLAttributes["class"] }>();

const context = injectColorPickerContext();

const delegated = computed(() => {
  const { class: _, color: __, ...rest } = props;
  return rest;
});
</script>

<template>
  <ColorSwatch
    v-bind="delegated"
    data-slot="color-picker-preview"
    :color="props.color || context.hex.value"
    :class="cn(colorPickerPreview, props.class)"
  >
    <span
      aria-hidden="true"
      :class="colorPickerPreviewColor"
    />
  </ColorSwatch>
</template>
