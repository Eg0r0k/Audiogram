<script setup lang="ts">
import { EditablePreview, type EditablePreviewProps, injectEditableRootContext, useForwardExpose } from "reka-ui";
import { type HTMLAttributes, computed, nextTick, watch } from "vue";

import { cn } from "@/lib/utils";
import { editablePreviewVariants, injectEditableContext } from ".";

const props = defineProps<EditablePreviewProps & { class?: HTMLAttributes["class"] }>();

const context = injectEditableRootContext();
const editable = injectEditableContext();
const { forwardRef, currentElement } = useForwardExpose();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});

// Enter and Escape hide the focused input; hand focus back without starting a focus-activated edit again
let returning = false;
watch(context.isEditing, (editing) => {
  if (editing || document.activeElement !== context.inputRef.value) return;
  nextTick(() => {
    returning = true;
    currentElement.value?.focus({ preventScroll: true });
    returning = false;
  });
});
// The template sets tabindex itself: Reka's preview stays focusable and starts editing even when the root is disabled
const skipActivation = (event: FocusEvent) => {
  if (returning) event.stopImmediatePropagation();
};
</script>

<template>
  <EditablePreview
    v-bind="delegated"
    :ref="forwardRef"
    data-slot="editable-preview"
    :tabindex="context.disabled.value ? -1 : 0"
    :hidden="!editable.autoResize.value && context.isEditing.value"
    :class="
      cn(
        editablePreviewVariants({ autoResize: editable.autoResize.value }),
        context.disabled.value && 'pointer-events-none',
        props.class,
      )
    "
    @focusin.capture="skipActivation"
  >
    <slot />
  </EditablePreview>
</template>
