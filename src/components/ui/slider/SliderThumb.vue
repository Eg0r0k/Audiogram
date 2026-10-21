<script setup lang="ts">
import { SliderThumb as RekaSliderThumb, type SliderThumbProps } from "reka-ui";
import { type HTMLAttributes, computed, ref } from "vue";

import { cn } from "@/lib/utils";
import { injectSliderContext, sliderThumbVariants } from ".";
import SliderHandle from "./SliderHandle.vue";

const props = defineProps<SliderThumbProps & { class?: HTMLAttributes["class"] }>();
defineSlots<{ default?: () => unknown }>();

const slider = injectSliderContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});

// Only a mouse hovers: a tap fires pointerenter too
const hovered = ref(false);
const onEnter = (event: PointerEvent) => {
  if (event.pointerType === "mouse") hovered.value = true;
};
</script>

<template>
  <RekaSliderThumb
    v-bind="{ ...slider.thumbAttrs.value, ...delegated }"
    data-slot="slider-thumb"
    :data-hovered="hovered || undefined"
    :class="
      cn(sliderThumbVariants({ variant: slider.variant.value, touchTarget: slider.touchTarget.value }), props.class)
    "
    @pointerenter="onEnter"
    @pointerleave="hovered = false"
  >
    <slot><SliderHandle /></slot>
  </RekaSliderThumb>
</template>
