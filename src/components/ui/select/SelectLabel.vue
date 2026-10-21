<script setup lang="ts">
import { SelectLabel, type SelectLabelProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";
import { menuLabel } from "@/components/ui/menu";

const props = defineProps<SelectLabelProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SelectLabel
    v-bind="delegated"
    data-slot="select-label"
    :class="cn(menuLabel, props.class)"
  >
    <slot />
  </SelectLabel>
</template>
