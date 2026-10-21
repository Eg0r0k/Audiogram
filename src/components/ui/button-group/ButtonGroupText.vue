<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>(), { as: "div" });
</script>

<template>
  <Primitive
    data-slot="button-group-text"
    :as="as"
    :as-child="asChild"
    :class="
      cn(
        `
          flex items-center gap-2 rounded-control-md border border-input bg-muted px-4 text-label-lg
          text-muted-foreground
          [&_svg]:pointer-events-none
          icon-size-4
        `,
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>
