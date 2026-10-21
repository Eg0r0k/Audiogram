<script setup lang="ts">
import { EditableRoot, type EditableRootEmits, type EditableRootProps, useForwardPropsEmits } from "reka-ui";
import { type HTMLAttributes, computed, toRef } from "vue";

import { cn } from "@/lib/utils";
import { provideEditableContext } from ".";

const props = withDefaults(defineProps<EditableRootProps & { class?: HTMLAttributes["class"] }>(), {
  activationMode: "focus",
  submitMode: "blur",
  autoResize: true,
});
const emits = defineEmits<EditableRootEmits>();

provideEditableContext({ autoResize: toRef(props, "autoResize") });

const delegated = computed(() => {
  const { class: _, autoResize: __, ...rest } = props;
  return { ...rest, autoResize: false };
});
const forwarded = useForwardPropsEmits(delegated, emits);
</script>

<template>
  <EditableRoot
    v-slot="slotProps"
    v-bind="forwarded"
    data-slot="editable"
    :class="cn('flex min-w-0 items-center gap-3', props.class)"
  >
    <slot v-bind="slotProps" />
  </EditableRoot>
</template>
