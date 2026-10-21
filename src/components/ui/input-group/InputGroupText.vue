<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>(), { as: "span" });
</script>

<template>
  <Primitive
    data-slot="input-group-text"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        `
          flex items-center gap-2 text-body-md text-muted-foreground
          [&_svg]:pointer-events-none
          icon-size-(--input-group-icon)
        `,
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>
