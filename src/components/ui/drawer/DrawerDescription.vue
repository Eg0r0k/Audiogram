<script setup lang="ts">
import { DialogDescription, type DialogDescriptionProps } from "@kappa-ui/core/dialog";
import { type HTMLAttributes, computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<DialogDescriptionProps & { class?: HTMLAttributes["class"] }>();

const delegated = computed(() => {
  const { class: _, ...rest } = props;
  return rest;
});
</script>

<template>
  <DialogDescription
    v-bind="delegated"
    data-slot="drawer-description"
    :class="cn('text-body-md text-muted-foreground', props.class)"
  >
    <slot />
  </DialogDescription>
</template>
