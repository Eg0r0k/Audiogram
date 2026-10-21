<script setup lang="ts">
import { DialogClose, type DialogCloseProps } from "@kappa-ui/core/dialog";

const props = defineProps<DialogCloseProps>();
</script>

<template>
  <DialogClose
    v-bind="props"
    data-slot="dialog-close"
  >
    <slot />
  </DialogClose>
</template>
