<template>
  <div
    :class="['inline-flex items-center justify-center', rootClass]"
  >
    <span
      v-if="!isEditing"
      role="button"
      tabindex="0"
      :class="[
        'cursor-pointer select-none rounded px-1 transition-colors',
        'hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary',
        displayClass
      ]"
      :title="computedEditHint"
      @dblclick="startEdit"
      @keydown.enter="startEdit"
      @keydown.space.prevent="startEdit"
    >
      {{ formattedValue }}{{ suffix }}
    </span>

    <input
      v-else
      ref="inputRef"
      v-model="inputValue"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      :aria-label="computedAriaLabel"
      :class="[
        'bg-background border border-primary rounded px-1 text-center',
        'focus:outline-none focus:ring-1 focus:ring-primary',
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        inputClass
      ]"
      @blur="commitEdit"
      @keydown.enter="commitEdit"
      @keydown.escape="cancelEdit"
      @keydown.up.prevent="increment"
      @keydown.down.prevent="decrement"
    >
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { ref, computed, nextTick, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = withDefaults(defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  showSign?: boolean;
  suffix?: string;
  editHint?: string;
  ariaLabel?: string;
  rootClass?: HTMLAttributes["class"];
  displayClass?: HTMLAttributes["class"];
  inputClass?: HTMLAttributes["class"];
}>(), {
  min: -Infinity,
  max: Infinity,
  step: 1,
  showSign: true,
  suffix: "",
  editHint: undefined,
  ariaLabel: undefined,
  rootClass: "",
  displayClass: "",
  inputClass: "",
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
  "change": [value: number];
}>();

const computedEditHint = computed(() =>
  props.editHint ?? t("common.editHint"),
);

const computedAriaLabel = computed(() =>
  props.ariaLabel ?? t("common.editLabel"),
);

const inputRef = useTemplateRef("inputRef");
const isEditing = ref(false);
const inputValue = ref("");

const formattedValue = computed(() => {
  const val = Math.round(props.modelValue);
  if (props.showSign && val > 0) {
    return `+${val}`;
  }
  return String(val);
});

const startEdit = () => {
  inputValue.value = String(Math.round(props.modelValue));
  isEditing.value = true;

  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
};

const commitEdit = () => {
  const parsed = parseFloat(inputValue.value);

  if (!Number.isNaN(parsed)) {
    const clamped = Math.max(props.min, Math.min(props.max, parsed));
    const rounded = Math.round(clamped / props.step) * props.step;

    if (rounded !== props.modelValue) {
      emit("update:modelValue", rounded);
      emit("change", rounded);
    }
  }

  isEditing.value = false;
};

const cancelEdit = () => {
  isEditing.value = false;
};

const increment = () => {
  const current = parseFloat(inputValue.value) || 0;
  const newValue = Math.min(props.max, current + props.step);
  inputValue.value = String(newValue);
};

const decrement = () => {
  const current = parseFloat(inputValue.value) || 0;
  const newValue = Math.max(props.min, current - props.step);
  inputValue.value = String(newValue);
};
</script>
