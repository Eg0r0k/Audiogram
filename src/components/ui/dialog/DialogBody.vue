<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="dialog-body"
    :class="cn('-mx-6 -my-1 min-h-0 overflow-y-auto px-6 py-1', props.class)"
  >
    <slot />
  </div>
</template>
