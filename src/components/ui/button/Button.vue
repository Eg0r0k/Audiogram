<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { type ButtonColor, type ButtonSize, type ButtonVariants, buttonVariants, swallowWhenDisabled } from ".";

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"];
  color?: ButtonColor | (string & {});
  size?: ButtonSize;
  touchTarget?: ButtonVariants["touchTarget"];
  /** `inward` draws the focus ring inside, for hosts that clip overflow. */
  focusRing?: ButtonVariants["focusRing"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  variant: "solid",
  color: "primary",
  size: "md",
});
</script>

<template>
  <Primitive
    v-ripple
    data-slot="button"
    :data-variant="props.variant"
    :data-color="props.color"
    :data-size="props.size"
    :as="as"
    :as-child="asChild"
    :class="
      cn(
        buttonVariants({
          variant: props.variant,
          size: props.size,
          touchTarget: props.touchTarget,
          focusRing: props.focusRing,
        }),
        props.class,
      )
    "
    @click.capture="swallowWhenDisabled"
  >
    <slot />
  </Primitive>
</template>
