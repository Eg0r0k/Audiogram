<script setup lang="ts">
import { NumberFieldInput, useForwardExpose } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { injectInputNumberContext, inputNumberInput, inputNumberInputInset } from ".";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();

const context = injectInputNumberContext();
const inset = computed(() => inputNumberInputInset[context.value.orientation ?? "horizontal"]);
const { forwardRef } = useForwardExpose();
</script>

<template>
  <NumberFieldInput
    :ref="forwardRef"
    data-slot="input-number-input"
    :required="context.required || undefined"
    :aria-invalid="context.invalid"
    :aria-describedby="context.describedBy"
    :class="cn(inputNumberInput, inset, props.class)"
  />
</template>
