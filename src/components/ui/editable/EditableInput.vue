<script setup lang="ts">
import { EditableInput, type EditableInputProps, injectEditableRootContext } from "reka-ui";
import { type HTMLAttributes, computed, watch } from "vue";

import { cn } from "@/lib/utils";
import { editableInputVariants, injectEditableContext } from ".";

const props = defineProps<EditableInputProps & { class?: HTMLAttributes["class"] }>();

const context = injectEditableRootContext();
const editable = injectEditableContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});

// Reka keeps a cancelled draft until the next edit, and the hidden field would keep the box that wide
watch(context.isEditing, (editing) => {
  if (!editing) context.inputValue.value = context.modelValue.value;
});

const keepFormUnsubmitted = (event: KeyboardEvent) => {
  const mode = context.submitMode.value;
  if ((mode === "enter" || mode === "both") && !event.shiftKey && !event.metaKey && !event.isComposing) {
    event.preventDefault();
  }
};

// Bound to the input's size: it sizes the field where field-sizing is missing; Reka's own width is the 20-character default
const length = computed(() =>
  Math.max(1, (context.inputValue.value ?? "").length, (context.placeholder.value?.edit ?? "").length),
);
</script>

<template>
  <EditableInput
    v-bind="delegated"
    data-slot="editable-input"
    :size="length"
    :hidden="!editable.autoResize.value && !context.isEditing.value"
    :class="cn(editableInputVariants({ autoResize: editable.autoResize.value }), props.class)"
    @keydown.enter="keepFormUnsubmitted"
  />
</template>
