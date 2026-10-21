<script setup lang="ts">
import { SliderRange as RekaSliderRange, type SliderRangeProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { injectSliderContext, sliderRangeVariants } from ".";

const props = defineProps<SliderRangeProps & { class?: HTMLAttributes["class"] }>();

const slider = injectSliderContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <RekaSliderRange
    v-bind="delegated"
    data-slot="slider-range"
    :class="cn(sliderRangeVariants({ variant: slider.variant.value }), props.class)"
  />
</template>
