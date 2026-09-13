<script setup lang="ts">
import { provide, ref } from "vue";
import { DrawerMenuSubKey } from "./context";

// A submenu inside a sheet unfolds in place; the trigger toggles, the content
// expands below it. `update:open` mirrors the popper subs so lazy consumers
// (playlist list) still load on first open.
const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const open = ref(false);

const setOpen = (value: boolean) => {
  open.value = value;
  emit("update:open", value);
};

provide(DrawerMenuSubKey, { open, setOpen });
</script>

<template>
  <div
    data-slot="drawer-menu-sub"
    :data-state="open ? 'open' : 'closed'"
  >
    <slot />
  </div>
</template>
