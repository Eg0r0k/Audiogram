<script setup lang="ts">
import { type HTMLAttributes, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { textControlBase, textControlInnerText } from "@/lib/text-control";
import { cn } from "@/lib/utils";
import { inputGroupControlInset } from ".";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  id?: string;
  defaultValue?: string | number;
  disabled?: boolean;
  required?: boolean;
  class?: HTMLAttributes["class"];
}>();

const model = defineModel<string | number>();
if (model.value === undefined && props.defaultValue !== undefined) model.value = props.defaultValue;

const attrs = useAttrs();
const control = useFieldControl(props, attrs);
</script>

<template>
  <input
    v-bind="attrs"
    :id="control.id.value"
    v-model="model"
    data-slot="input-group-control"
    :disabled="control.disabled.value"
    :required="control.required.value"
    :aria-invalid="control.invalid.value"
    :aria-describedby="control.describedBy.value"
    :class="
      cn(
        textControlBase,
        textControlInnerText,
        'h-full min-h-[calc(var(--input-group-height)-2px)] flex-1 rounded-none px-(--input-group-padding)',
        inputGroupControlInset,
        props.class,
      )
    "
  >
</template>
