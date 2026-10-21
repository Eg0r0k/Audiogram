<script setup lang="ts">
import { DialogTrigger, type DialogTriggerProps } from "@kappa-ui/core/dialog";

const props = defineProps<DialogTriggerProps>();
</script>

<template>
  <DialogTrigger
    v-bind="props"
    data-slot="dialog-trigger"
  >
    <slot />
  </DialogTrigger>
</template>
