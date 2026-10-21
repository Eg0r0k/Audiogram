<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    data-slot="empty-media"
    :class="
      cn(
        `
          flex shrink-0 items-center justify-center text-muted-foreground
          [&_svg]:pointer-events-none [&_svg]:shrink-0
          [:where(&>svg:not([class*=size-]))]:size-(--empty-icon)
        `,
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
