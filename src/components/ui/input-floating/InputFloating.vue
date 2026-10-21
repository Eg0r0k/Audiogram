<script setup lang="ts">
import { useForwardExpose, useId } from "reka-ui";
import { type HTMLAttributes, computed, useAttrs } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import {
  type InputFloatingSize,
  type InputFloatingVariants,
  inputFloatingInputVariants,
  inputFloatingLabelVariants,
  inputFloatingLegendVariants,
  inputFloatingOutlineVariants,
  inputFloatingVariants,
} from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    id?: string;
    defaultValue?: string | number;
    variant?: InputFloatingVariants["variant"];
    size?: InputFloatingSize;
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
const generatedId = useId(undefined, "input");
const { forwardRef } = useForwardExpose();

const alwaysFloating = new Set(["date", "datetime-local", "month", "time", "week", "color", "file"]);

const inputId = computed(() => control.id.value ?? generatedId);

const inputBindings = computed(() => ({
  ...attrs,
  "id": inputId.value,
  "disabled": control.disabled.value,
  "required": control.required.value,
  "aria-invalid": control.invalid.value,
  "aria-describedby": control.describedBy.value,
}));
</script>

<template>
  <div
    data-slot="input-floating"
    :data-variant="props.variant ?? 'outline'"
    :data-size="props.size"
    :data-float="alwaysFloating.has(String(attrs.type)) || undefined"
    :class="cn(inputFloatingVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <input
      v-bind="inputBindings"
      :ref="forwardRef"
      v-model="model"
      data-slot="input-floating-input"
      :placeholder="(attrs.placeholder as string | undefined) ?? ' '"
      :class="cn(inputFloatingInputVariants({ variant: props.variant, size: props.size }))"
    >
    <label
      data-slot="input-floating-label"
      :for="inputId"
      :class="cn(inputFloatingLabelVariants({ variant: props.variant, size: props.size }))"
    >
      {{ props.label }}<span
        v-if="control.required.value"
        aria-hidden="true"
      > *</span>
    </label>
    <fieldset
      v-if="(props.variant ?? 'outline') === 'outline'"
      aria-hidden="true"
      :class="inputFloatingOutlineVariants({ size: props.size })"
    >
      <legend :class="inputFloatingLegendVariants()">
        {{ props.label }}<span v-if="control.required.value"> *</span>
      </legend>
    </fieldset>
  </div>
</template>
