<template>
  <div :class="['rounded-lg bg-muted p-3', $attrs.class]">
    <div class="text-sm font-medium tracking-wide text-muted-foreground">
      {{ label }}
    </div>
    <div class="mt-1 text-sm break-all">
      {{ displayValue }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  label: string;
  value?: string | number | null;
}>();

const displayValue = computed(() => {
  return props.value === undefined || props.value === null || props.value === ""
    ? "—"
    : String(props.value);
});
</script>
