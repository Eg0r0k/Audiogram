<script setup lang="ts">
import { SliderTrack as RekaSliderTrack, type SliderTrackProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { injectSliderContext, sliderTrackVariants } from ".";

const props = defineProps<SliderTrackProps & { class?: HTMLAttributes["class"] }>();

const slider = injectSliderContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <RekaSliderTrack
    v-bind="delegated"
    data-slot="slider-track"
    :class="cn(sliderTrackVariants({ variant: slider.variant.value }), props.class)"
  >
    <slot />
  </RekaSliderTrack>
</template>
