<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <p
    data-slot="item-description"
    :class="
      cn(
        `
          line-clamp-2 text-body-md leading-normal text-balance text-muted-foreground
          [&>a]:underline [&>a]:underline-offset-4
          [&>a:hover]:text-primary
        `,
        props.class,
      )
    "
  >
    <slot />
  </p>
</template>
