<script setup lang="ts">
import { Primitive, type PrimitiveProps, useForwardExpose } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import vRipple from "@/lib/ripple";
import { cn } from "@/lib/utils";
import { type ItemSize, type ItemVariants, injectItemGroupContext, itemVariants } from ".";

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      variant?: NonNullable<ItemVariants["variant"]>;
      size?: ItemSize;
      class?: HTMLAttributes["class"];
    }
  >(),
  { as: "div", variant: "ghost", size: "md" },
);

const group = injectItemGroupContext(null);

const role = computed(() =>
  group?.list.value && !props.asChild && props.as !== "a" && props.as !== "button" ? "listitem" : undefined,
);

const attrs = useAttrs();
const { forwardRef, currentElement } = useForwardExpose();
// A row with a click handler presses like a link or a button does.
const pressable = computed(() => Boolean(attrs.onClick) || (currentElement.value?.matches("a, button") ?? false));
</script>

<template>
  <Primitive
    :ref="forwardRef"
    v-ripple
    data-slot="item"
    :data-pressable="pressable || undefined"
    :data-variant="props.variant"
    :data-size="props.size"
    :role="role"
    :as="as"
    :as-child="asChild"
    :class="cn(itemVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
