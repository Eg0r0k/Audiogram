<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { provide } from "vue";
import { cn } from "@/lib/utils";
import { DrawerMenuRadioGroupKey } from "./context";

const props = defineProps<{
  modelValue?: string;
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

provide(DrawerMenuRadioGroupKey, {
  value: () => props.modelValue,
  select: value => emit("update:modelValue", value),
});
</script>

<template>
  <div
    role="radiogroup"
    data-slot="drawer-menu-radio-group"
    :class="cn(props.class)"
  >
    <slot />
  </div>
</template>
