<script setup lang="ts">
import type { DrawerDirection } from "vaul-vue";
import { DrawerRoot } from "vaul-vue";
import { registerOverlayBackHandler } from "@/composables/useOverlayBackButton";

// Always controlled: vaul's root props are a union that withDefaults cannot
// type, and an uncontrolled sheet has no consumer here anyway.
//
// Dragging is limited to the handle by default. A sheet that drags anywhere
// turns every quick touch on a row into a dismissal (vaul closes on flick
// velocity, not only distance) and the mouseup after a drag still clicks the
// row underneath; rows in a menu must behave like plain buttons.
//
// No overlay scroll lock on purpose: the modal overlay already swallows wheel
// and touch over the page, and the shared lock would also freeze a Scrollable
// inside the sheet.
const props = withDefaults(defineProps<{
  open: boolean;
  dismissible?: boolean;
  modal?: boolean;
  handleOnly?: boolean;
  direction?: DrawerDirection;
}>(), {
  dismissible: true,
  modal: true,
  handleOnly: true,
  direction: "bottom",
});

const emits = defineEmits<{
  "update:open": [open: boolean];
}>();

// Android's hardware back dismisses through the dialog's Escape path, which
// keeps focus restoration and the exit animation identical to a normal close.
registerOverlayBackHandler({
  depth: () => (props.open ? 1 : 0),
  back: () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  },
});
</script>

<template>
  <DrawerRoot
    data-slot="drawer"
    :open="open"
    :dismissible="dismissible"
    :modal="modal"
    :handle-only="handleOnly"
    :direction="direction"
    :no-body-styles="true"
    @update:open="emits('update:open', $event)"
  >
    <slot />
  </DrawerRoot>
</template>
