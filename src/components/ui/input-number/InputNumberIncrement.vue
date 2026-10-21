<script setup lang="ts">
import IconChevronUp from "~icons/tabler/chevron-up";
import IconPlus from "~icons/tabler/plus";
import { NumberFieldIncrement } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { injectInputNumberContext, inputNumberButtonVariants } from ".";

const props = defineProps<{ disabled?: boolean; class?: HTMLAttributes["class"] }>();

const context = injectInputNumberContext();
</script>

<template>
  <NumberFieldIncrement
    as-child
    :disabled="props.disabled"
  >
    <Button
      data-slot="input-number-increment"
      variant="ghost"
      color="neutral"
      :class="cn(inputNumberButtonVariants({ orientation: context.orientation, part: 'increment' }), props.class)"
    >
      <slot>
        <IconChevronUp v-if="context.orientation === 'vertical'" />
        <IconPlus v-else />
      </slot>
    </Button>
  </NumberFieldIncrement>
</template>
