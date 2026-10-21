<script setup lang="ts">
import { NumberFieldInput, useForwardExpose } from "reka-ui";
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { injectInputNumberContext, inputNumberInput } from ".";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const context = injectInputNumberContext();
const { forwardRef } = useForwardExpose();
</script>

<template>
  <NumberFieldInput
    :ref="forwardRef"
    data-slot="input-number-input"
    :required="context.required || undefined"
    :aria-invalid="context.invalid"
    :aria-describedby="context.describedBy"
    :class="cn(inputNumberInput, props.class)"
  />
</template>
