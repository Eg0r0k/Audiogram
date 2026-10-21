<script setup lang="ts">
import IconChevronDown from "~icons/tabler/chevron-down";
import IconMinus from "~icons/tabler/minus";
import { NumberFieldDecrement } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { injectInputNumberContext, inputNumberButtonVariants } from ".";

const props = defineProps<{ disabled?: boolean; class?: HTMLAttributes["class"] }>();

const context = injectInputNumberContext();
</script>

<template>
  <NumberFieldDecrement
    as-child
    :disabled="props.disabled"
  >
    <Button
      data-slot="input-number-decrement"
      variant="ghost"
      color="neutral"
      :class="
        cn(
          inputNumberButtonVariants({ orientation: context.orientation, part: 'decrement' }),
          context.orientation === 'vertical' && context.variant === 'filled' && 'rounded-ee-none',
          props.class,
        )
      "
    >
      <slot>
        <IconChevronDown v-if="context.orientation === 'vertical'" />
        <IconMinus v-else />
      </slot>
    </Button>
  </NumberFieldDecrement>
</template>
