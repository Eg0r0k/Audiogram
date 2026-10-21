<script setup lang="ts">
import { ToastTitle, type ToastTitleProps } from "@kappa-ui/core/toast";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<ToastTitleProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <ToastTitle
    v-bind="delegated"
    data-slot="toast-title"
    :class="cn('text-[13px]/5 font-medium text-foreground', props.class)"
  >
    <slot />
  </ToastTitle>
</template>
