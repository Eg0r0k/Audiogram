<script setup lang="ts">
import IconChevronUp from "~icons/tabler/chevron-up";
import { SelectScrollUpButton, type SelectScrollUpButtonProps } from "reka-ui";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<SelectScrollUpButtonProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <SelectScrollUpButton
    v-bind="delegated"
    data-slot="select-scroll-up-button"
    :class="
      cn('flex shrink-0 cursor-default items-center justify-center py-1 text-muted-foreground icon-size-4', props.class)
    "
  >
    <slot>
      <IconChevronUp />
    </slot>
  </SelectScrollUpButton>
</template>
