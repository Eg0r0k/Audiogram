<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="drawer-body"
    :class="
      cn(
        '-my-1 min-h-0 overflow-y-hidden overscroll-contain px-6 py-1 group-data-[expanded]/drawer:overflow-y-auto',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
