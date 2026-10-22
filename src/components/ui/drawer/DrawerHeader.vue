<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="drawer-header"
    :class="
      cn(
        'flex shrink-0 flex-col gap-1.5 px-6 has-[~[data-slot=drawer-close]]:pe-14 [[data-slot=drawer-close]~&]:pe-14',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
