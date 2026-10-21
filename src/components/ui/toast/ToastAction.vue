<script setup lang="ts">
import { ToastAction } from "@kappa-ui/core/toast";
import type { HTMLAttributes } from "vue";

import { Button, type ButtonColor, type ButtonSize, type ButtonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    altText: string;
    variant?: ButtonVariants["variant"];
    color?: ButtonColor | (string & {});
    size?: ButtonSize;
    class?: HTMLAttributes["class"];
  }>(),
  { variant: "ghost", color: "primary", size: "sm" },
);
</script>

<template>
  <ToastAction
    :alt-text="props.altText"
    as-child
  >
    <Button
      data-slot="toast-action"
      :variant="props.variant"
      :color="props.color"
      :size="props.size"
      :class="cn('px-2.5 text-xs', props.class)"
    >
      <slot />
    </Button>
  </ToastAction>
</template>
