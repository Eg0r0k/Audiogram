<script setup lang="ts">
import { ColorAreaArea, ColorAreaRoot, type ColorAreaRootProps, ColorAreaThumb } from "reka-ui";
import { type HTMLAttributes, computed, ref } from "vue";

import { cn } from "@/lib/utils";
import { sliderHandleVariants, sliderThumbVariants } from "@/components/ui/slider";
import { colorPickerArea, colorPickerAreaCanvas, colorPickerAreaHandle, injectColorPickerContext } from ".";

const props = withDefaults(
  defineProps<
    Omit<ColorAreaRootProps, "modelValue" | "defaultValue" | "disabled"> & { class?: HTMLAttributes["class"] }
  >(),
  { colorSpace: "hsb", xChannel: "saturation", yChannel: "brightness" },
);

const context = injectColorPickerContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});

const hovered = ref(false);
const onPointerEnter = (event: PointerEvent) => {
  if (event.pointerType === "mouse") hovered.value = true;
};
const onPointerLeave = () => {
  hovered.value = false;
};

const onPointerDown = (event: PointerEvent) => {
  const root = event.currentTarget as HTMLElement;
  queueMicrotask(() => {
    const thumb = document.activeElement;
    if (!(thumb instanceof HTMLElement) || !root.contains(thumb) || !thumb.matches(":focus-visible")) return;
    thumb.blur();
    thumb.focus({ focusVisible: false });
  });
};
</script>

<template>
  <ColorAreaRoot
    v-slot="{ style }"
    v-bind="delegated"
    data-slot="color-picker-area"
    :model-value="context.color.value"
    :disabled="context.disabled.value"
    :class="cn(colorPickerArea, props.class)"
    @pointerdown="onPointerDown"
    @update:color="context.setColor"
  >
    <ColorAreaArea
      data-slot="color-picker-area-canvas"
      :style="style"
      :class="colorPickerAreaCanvas"
    >
      <ColorAreaThumb
        data-slot="color-picker-area-thumb"
        :data-hovered="hovered || undefined"
        :aria-invalid="context.invalid.value"
        :aria-describedby="context.describedBy.value"
        :style="{ '--tone': context.opaque.value }"
        :class="sliderThumbVariants({ variant: 'default' })"
        @pointerenter="onPointerEnter"
        @pointerleave="onPointerLeave"
      >
        <span
          data-slot="color-picker-area-handle"
          :class="cn(sliderHandleVariants({ variant: 'default' }), colorPickerAreaHandle)"
        />
      </ColorAreaThumb>
    </ColorAreaArea>
  </ColorAreaRoot>
</template>
