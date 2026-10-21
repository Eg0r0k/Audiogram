<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

import { type KbdSize, kbdVariants } from ".";

const props = withDefaults(defineProps<{ size?: KbdSize; class?: HTMLAttributes["class"] }>(), { size: "md" });
</script>

<template>
  <kbd
    data-slot="kbd"
    :data-size="props.size"
    :class="cn(kbdVariants({ size: props.size }), props.class)"
  >
    <slot />
  </kbd>
</template>
