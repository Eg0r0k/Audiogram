<script setup lang="ts">
import { ContextMenu, ContextMenuCloseBridge } from "@/components/ui/context-menu";
import { Drawer } from "@/components/ui/drawer";
import { contextParts } from "./sets";
import { useResponsiveMenuRoot } from "./useResponsiveMenuRoot";

/**
 * Right-click menu on desktop widths, bottom sheet on long-press on mobile.
 * reka's context root has no `open` prop (a popper needs a pointer position),
 * so a controlled close is pushed through the bridge instead.
 */
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
  popperParts: contextParts,
  open: () => props.open,
  onUpdateOpen: open => emits("update:open", open),
});
</script>

<template>
  <ContextMenu
    v-if="mode === 'popper'"
    :modal="modal"
    @update:open="setOpen"
  >
    <ContextMenuCloseBridge :open="isOpen" />
    <slot />
  </ContextMenu>
  <Drawer
    v-else
    :open="isOpen"
    :modal="modal"
    @update:open="setOpen"
  >
    <slot />
  </Drawer>
</template>
