<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { type SkeletonColor, type SkeletonVariants, skeletonVariants } from ".";

const props = defineProps<{
  variant?: SkeletonVariants["variant"];
  animation?: SkeletonVariants["animation"];
  color?: SkeletonColor | (string & {});
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="skeleton"
    :data-variant="props.variant ?? 'rect'"
    :data-animation="props.animation ?? 'pulse'"
    :data-color="props.color"
    aria-hidden="true"
    :class="cn(skeletonVariants({ variant: props.variant, animation: props.animation }), props.class)"
  />
</template>
