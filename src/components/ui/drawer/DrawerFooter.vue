<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="drawer-footer"
    :class="cn('flex shrink-0 flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end', props.class)"
  >
    <slot />
  </div>
</template>
