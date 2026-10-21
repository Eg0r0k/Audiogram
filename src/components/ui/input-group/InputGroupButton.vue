<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { injectFieldContext } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import { Button, type ButtonColor, type ButtonVariants } from "@/components/ui/button";
import { type InputGroupButtonVariants, inputGroupButtonVariants } from ".";

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants["variant"];
    color?: ButtonColor | (string & {});
    size?: NonNullable<InputGroupButtonVariants["size"]>;
    type?: "button" | "submit" | "reset";
    class?: HTMLAttributes["class"];
  }>(),
  { variant: "ghost", color: "neutral", size: "xs", type: "button" },
);

const field = injectFieldContext(null);
</script>

<template>
  <Button
    data-slot="input-group-button"
    :data-size="props.size"
    :type="props.type"
    :variant="props.variant"
    :color="props.color"
    :size="props.size"
    :disabled="field?.disabled.value || undefined"
    :class="cn(inputGroupButtonVariants({ size: props.size }), props.class)"
  >
    <slot />
  </Button>
</template>
