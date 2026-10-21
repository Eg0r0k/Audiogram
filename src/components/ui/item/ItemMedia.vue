<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { type ItemMediaVariants, itemMediaVariants } from ".";

const props = withDefaults(
  defineProps<{
    variant?: NonNullable<ItemMediaVariants["variant"]>;
    class?: HTMLAttributes["class"];
  }>(),
  { variant: "default" },
);
</script>

<template>
  <div
    data-slot="item-media"
    :data-variant="props.variant"
    :class="cn(itemMediaVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </div>
</template>
