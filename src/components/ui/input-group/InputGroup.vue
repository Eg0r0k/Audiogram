<script setup lang="ts">
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { type InputGroupSize, type InputGroupVariant, inputGroupVariants, provideInputGroupContext } from ".";

const props = withDefaults(
  defineProps<{
    variant?: InputGroupVariant;
    size?: InputGroupSize;
    class?: HTMLAttributes["class"];
  }>(),
  { variant: "outline", size: "md" },
);

provideInputGroupContext({
  variant: computed(() => props.variant),
  size: computed(() => props.size),
});
</script>

<template>
  <div
    role="group"
    data-slot="input-group"
    :data-variant="props.variant"
    :data-size="props.size"
    :class="cn(inputGroupVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
  </div>
</template>
