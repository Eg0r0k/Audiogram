<script setup lang="ts">
import { SelectSeparator, type SelectSeparatorProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { menuSeparator } from "@/components/ui/menu";

const props = defineProps<SelectSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SelectSeparator
    v-bind="delegated"
    data-slot="select-separator"
    :class="cn(menuSeparator, props.class)"
  />
</template>
