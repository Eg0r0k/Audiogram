<script setup lang="ts">
import { ToastDescription, type ToastDescriptionProps } from "@kappa-ui/core/toast";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<ToastDescriptionProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <ToastDescription
    v-bind="delegated"
    data-slot="toast-description"
    :class="cn('text-body-md text-muted-foreground', props.class)"
  >
    <slot />
  </ToastDescription>
</template>
