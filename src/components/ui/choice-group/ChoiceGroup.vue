<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { type ChoiceGroupColor, type ChoiceGroupVariants, choiceGroupVariants } from ".";

interface Props extends PrimitiveProps {
  variant?: ChoiceGroupVariants["variant"];
  orientation?: ChoiceGroupVariants["orientation"];
  /** The tone of a selected card's edge, a focused card's ring and the selected row's tint. */
  color?: ChoiceGroupColor | (string & {});
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), { as: "div", color: "primary" });
</script>

<template>
  <Primitive
    data-slot="choice-group"
    :as="props.as"
    :as-child="props.asChild"
    :data-variant="props.variant ?? 'default'"
    :data-orientation="props.orientation ?? 'vertical'"
    :data-color="props.color"
    :class="cn(choiceGroupVariants({ variant: props.variant, orientation: props.orientation }), props.class)"
  >
    <slot />
  </Primitive>
</template>
