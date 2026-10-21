<script setup lang="ts">
import { DialogTitle, type DialogTitleProps } from "@kappa-ui/core/dialog";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DialogTitle
    v-bind="delegated"
    data-slot="dialog-title"
    :class="cn('text-xl leading-none font-semibold', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
