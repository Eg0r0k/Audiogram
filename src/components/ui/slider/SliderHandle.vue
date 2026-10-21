<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { injectSliderContext, sliderHandleVariants } from ".";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const slider = injectSliderContext();
</script>

<template>
  <span
    data-slot="slider-handle"
    :class="cn(sliderHandleVariants({ variant: slider.variant.value, shade: 'text' }), props.class)"
  />
</template>
