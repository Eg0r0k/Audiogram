<script setup lang="ts">
import { DialogRoot, type DialogRootEmits, type DialogRootProps } from "@kappa-ui/core/dialog";
import { useForwardPropsEmits } from "reka-ui";

const props = defineProps<DialogRootProps>();
const emits = defineEmits<DialogRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
