<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="alert-actions"
    :class="
      cn(
        `
          col-start-2 mt-(--alert-gap) flex shrink-0 flex-wrap items-center gap-1.5
          group-data-[orientation=horizontal]/alert:col-start-3 group-data-[orientation=horizontal]/alert:row-span-full
          group-data-[orientation=horizontal]/alert:ms-(--alert-gap) group-data-[orientation=horizontal]/alert:mt-0
          group-data-[orientation=horizontal]/alert:self-center
        `,
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
