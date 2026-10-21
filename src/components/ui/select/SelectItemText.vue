<script setup lang="ts">
import { SelectItemText, type SelectItemTextProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<SelectItemTextProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SelectItemText
    v-bind="delegated"
    data-slot="select-item-text"
    :class="cn('flex min-w-0 items-center gap-3 truncate', props.class)"
  >
    <slot />
  </SelectItemText>
</template>
