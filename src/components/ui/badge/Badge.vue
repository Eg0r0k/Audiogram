<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { type BadgeColor, type BadgeSize, type BadgeVariants, badgeVariants } from ".";

interface Props extends PrimitiveProps {
  variant?: NonNullable<BadgeVariants["variant"]>;
  color?: BadgeColor | (string & {});
  size?: BadgeSize;
  /** Render the badge with equal padding on all sides. */
  square?: boolean;
  touchTarget?: NonNullable<BadgeVariants["touchTarget"]>;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  as: "span",
  variant: "solid",
  color: "primary",
  size: "md",
  square: false,
  touchTarget: "none",
});
</script>

<template>
  <Primitive
    data-slot="badge"
    :data-variant="props.variant"
    :data-color="props.color"
    :data-size="props.size"
    :as="as"
    :as-child="asChild"
    :class="
      cn(
        badgeVariants({
          variant: props.variant,
          size: props.size,
          square: props.square,
          touchTarget: props.touchTarget,
        }),
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>
