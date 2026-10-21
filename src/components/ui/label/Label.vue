<script setup lang="ts">
import { Label, type LabelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<LabelProps & { class?: HTMLAttributes["class"] }>();
</script>

<template>
  <Label
    data-slot="label"
    :for="props.for"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        `
          inline-flex items-center gap-1 text-label-lg text-foreground select-none
          peer-disabled:cursor-not-allowed peer-disabled:text-foreground/(--disabled-opacity)
        `,
        props.class,
      )
    "
  >
    <slot />
  </Label>
</template>
