<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

interface Props extends PrimitiveProps {
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), { as: "h3" });
</script>

<template>
  <Primitive
    data-slot="empty-title"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('text-lg font-medium tracking-tight', props.class)"
  >
    <slot />
  </Primitive>
</template>
