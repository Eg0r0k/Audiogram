<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    data-slot="drawer-menu-label"
    :class="cn('px-3 py-2 text-sm font-medium text-muted-foreground', props.class)"
  >
    <slot />
  </div>
</template>
