<script setup lang="ts">
import { SelectGroup, type SelectGroupProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<SelectGroupProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SelectGroup
    v-bind="delegated"
    data-slot="select-group"
    :class="cn('flex flex-col', props.class)"
  >
    <slot />
  </SelectGroup>
</template>
