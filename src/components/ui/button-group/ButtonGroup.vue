<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { type ButtonGroupVariants, buttonGroupVariants } from ".";

const props = withDefaults(
  defineProps<{
    orientation?: NonNullable<ButtonGroupVariants["orientation"]>;
    class?: HTMLAttributes["class"];
  }>(),
  { orientation: "horizontal" },
);
</script>

<template>
  <div
    role="group"
    data-slot="button-group"
    :data-orientation="props.orientation"
    :class="cn(buttonGroupVariants({ orientation: props.orientation }), props.class)"
  >
    <slot />
  </div>
</template>
