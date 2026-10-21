<script setup lang="ts">
import { ColorSliderRoot, type ColorSliderRootProps, ColorSliderThumb, ColorSliderTrack, colorToString } from "reka-ui";
import { type HTMLAttributes, computed, ref } from "vue";

import { cn } from "@/lib/utils";
import {
  type SliderVariants,
  sliderHandleVariants,
  sliderThumbVariants,
  sliderTrackVariants,
  sliderVariants,
} from "@/components/ui/slider";
import { colorPickerSliderChecker, injectColorPickerContext } from ".";

const props = withDefaults(
  defineProps<
    Omit<ColorSliderRootProps, "modelValue" | "defaultValue" | "disabled" | "channel"> & {
      channel?: ColorSliderRootProps["channel"];
      variant?: SliderVariants["variant"];
      touchTarget?: SliderVariants["touchTarget"];
      class?: HTMLAttributes["class"];
    }
  >(),
  { channel: "hue", colorSpace: "hsb" },
);

const context = injectColorPickerContext();

const delegated = computed(() => {
  const { class: _, variant: __, touchTarget: ___, ...rest } = props;
  return rest;
});

const handleColor = (value: number) =>
  props.channel === "hue"
    ? colorToString({ space: "hsb", h: value, s: 100, b: 100, alpha: 1 }, "hex")
    : context.opaque.value;

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
  <ColorSliderRoot
    v-bind="delegated"
    data-slot="color-picker-slider"
    :data-channel="props.channel"
    :data-variant="props.variant ?? 'default'"
    :data-touch-target="props.touchTarget"
    :model-value="context.color.value"
    :disabled="context.disabled.value"
    :class="
      cn(
        sliderVariants({ variant: props.variant, size: context.size.value, touchTarget: props.touchTarget }),
        props.class,
      )
    "
    @pointerdown="onPointerDown"
    @update:color="context.setColor"
  >
    <span
      v-if="props.channel === 'alpha'"
      aria-hidden="true"
      :class="colorPickerSliderChecker"
    />
    <ColorSliderTrack
      data-slot="color-picker-slider-track"
      :class="cn(sliderTrackVariants({ variant: props.variant }), props.variant === 'inset' && 'bg-clip-padding!')"
    />
    <ColorSliderThumb
      v-slot="{ channelValue }"
      as-child
    >
      <span
        data-slot="color-picker-slider-thumb"
        :data-hovered="hovered || undefined"
        :aria-invalid="context.invalid.value"
        :aria-describedby="context.describedBy.value"
        :style="{ '--tone': handleColor(channelValue), '--tone-foreground': '#fff' }"
        :class="sliderThumbVariants({ variant: props.variant, touchTarget: props.touchTarget })"
        @pointerenter="onPointerEnter"
        @pointerleave="onPointerLeave"
      >
        <span
          data-slot="color-picker-slider-handle"
          :class="sliderHandleVariants({ variant: props.variant })"
        />
      </span>
    </ColorSliderThumb>
  </ColorSliderRoot>
</template>
