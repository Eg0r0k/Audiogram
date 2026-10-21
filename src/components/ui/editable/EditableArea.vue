<script setup lang="ts">
import { EditableArea, type EditableAreaProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { editableAreaVariants, injectEditableContext } from ".";

const props = defineProps<EditableAreaProps & { class?: HTMLAttributes["class"] }>();

const editable = injectEditableContext();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <EditableArea
    v-bind="delegated"
    data-slot="editable-area"
    :class="cn(editableAreaVariants({ autoResize: editable.autoResize.value }), props.class)"
  >
    <slot />
  </EditableArea>
</template>
