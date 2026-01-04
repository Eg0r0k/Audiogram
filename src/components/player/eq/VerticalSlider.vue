<template>
  <Slider
    v-model="proxyValue"
    :min="min"
    :max="max"
    :step="step"
    orientation="vertical"
    class="min-h-0!"
    @value-commit="onValueCommit"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Slider } from "@/components/ui/slider";

const props = withDefaults(defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>(), {
  min: -12,
  max: 12,
  step: 1,
});

const emit = defineEmits<{
  "update:modelValue": [value: number];
  "change": [value: number];
}>();

const proxyValue = computed({
  get: () => [props.modelValue],
  set: (val) => {
    if (val && val.length > 0) {
      emit("update:modelValue", val[0]);
    }
  },
});

const onValueCommit = (val: number[]) => {
  if (val && val.length > 0) {
    emit("change", val[0]);
  }
};
</script>
