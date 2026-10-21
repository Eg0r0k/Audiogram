<script setup lang="ts">
import { Drawer } from "@/components/ui/drawer";
import { useResponsiveMenuRoot } from "./useResponsiveMenuRoot";

/** Right-click menu on desktop widths, bottom sheet on long-press on mobile. */
const props = withDefaults(defineProps<{
  open?: boolean;
  modal?: boolean;
}>(), {
  open: undefined,
  modal: true,
});

const emits = defineEmits<{
  "update:open": [open: boolean];
}>();

const { mode, isOpen, setOpen } = useResponsiveMenuRoot({
  kind: "context",
  open: () => props.open,
  modal: () => props.modal,
  onUpdateOpen: open => emits("update:open", open),
});
</script>

<template>
  <slot v-if="mode === 'popper'" />
  <Drawer
    v-else
    :open="isOpen"
    :modal="modal"
    @update:open="setOpen"
  >
    <slot />
  </Drawer>
</template>
