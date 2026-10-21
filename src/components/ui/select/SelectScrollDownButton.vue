<script setup lang="ts">
import IconChevronDown from "~icons/tabler/chevron-down";
import { SelectScrollDownButton, type SelectScrollDownButtonProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<SelectScrollDownButtonProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SelectScrollDownButton
    v-bind="delegated"
    data-slot="select-scroll-down-button"
    :class="
      cn('flex shrink-0 cursor-default items-center justify-center py-1 text-muted-foreground icon-size-4', props.class)
    "
  >
    <slot>
      <IconChevronDown />
    </slot>
  </SelectScrollDownButton>
</template>
