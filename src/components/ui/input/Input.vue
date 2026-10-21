<script setup lang="ts">
import { useForwardExpose } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import type { TextControlSize } from "@/lib/text-control";
import { cn } from "@/lib/utils";
import { type InputVariants, inputVariants } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string;
    defaultValue?: string | number;
    variant?: InputVariants["variant"];
    size?: TextControlSize;
    disabled?: boolean;
    required?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  { size: "md" },
);

const model = defineModel<string | number>();
if (model.value === undefined && props.defaultValue !== undefined) model.value = props.defaultValue;

const attrs = useAttrs();
const control = useFieldControl(props, attrs);
const { forwardRef } = useForwardExpose();

const inputBindings = computed(() => ({
  ...attrs,
  "id": control.id.value,
  "disabled": control.disabled.value,
  "required": control.required.value,
  "aria-invalid": control.invalid.value,
  "aria-describedby": control.describedBy.value,
}));
</script>

<template>
  <input
    v-bind="inputBindings"
    :ref="forwardRef"
    v-model="model"
    data-slot="input"
    :data-variant="props.variant ?? 'outline'"
    :data-size="props.size"
    :class="cn(inputVariants({ variant: props.variant, size: props.size }), props.class)"
  >
</template>
