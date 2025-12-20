<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { useVModel } from "@vueuse/core";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  defaultValue?: string | number;
  modelValue?: string | number;
}>();

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void;
}>();

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
});
</script>
<!-- eslint-disable vuejs-accessibility/form-control-has-label -->
<template>
  <textarea
    v-model="modelValue"
    data-slot="textarea"
    :class="
      cn(
        'audiogram-textarea',
        'placeholder:text-muted-foreground selection:bg-primary caret-primary selection:text-primary-foreground dark:bg-background flex field-sizing-content min-h-16 w-full rounded-md bg-transparent px-3 py-2 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        props.class
      )
    "
  />
</template>

<style scoped>
.audiogram-textarea {
  border: 1px solid var(--border);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.audiogram-textarea:hover:not(:focus):not(:disabled):not([aria-invalid="true"]) {
  border-color: var(--primary);
}

.audiogram-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.audiogram-textarea[aria-invalid="true"] {
  border-color: var(--destructive);
}

.audiogram-textarea[aria-invalid="true"]:focus {
  box-shadow: 0 0 0 1px var(--destructive);
}
</style>
