<script setup lang="ts">
import { Primitive, type PrimitiveProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { type AlertColor, type AlertSize, type AlertVariants, alertVariants, provideAlertContext } from ".";

interface Props extends PrimitiveProps {
  variant?: NonNullable<AlertVariants["variant"]>;
  color?: AlertColor | (string & {});
  size?: AlertSize;
  orientation?: "vertical" | "horizontal";
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
  variant: "solid",
  color: "primary",
  size: "md",
  orientation: "vertical",
});

const open = defineModel<boolean>("open", { default: true });

provideAlertContext({
  close: () => {
    open.value = false;
  },
  size: computed(() => props.size),
});
</script>

<template>
  <Primitive
    v-if="open"
    data-slot="alert"
    role="alert"
    :data-variant="props.variant"
    :data-color="props.color"
    :data-size="props.size"
    :data-orientation="props.orientation"
    :as="as"
    :as-child="asChild"
    :class="cn(alertVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
