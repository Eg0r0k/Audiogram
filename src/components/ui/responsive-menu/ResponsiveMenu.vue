<script setup lang="ts">
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Drawer } from "@/components/ui/drawer";
import { dropdownParts } from "./sets";
import { useResponsiveMenuRoot } from "./useResponsiveMenuRoot";

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
  kind: "dropdown",
  popperParts: dropdownParts,
  open: () => props.open,
  onUpdateOpen: open => emits("update:open", open),
});
</script>

<template>
  <DropdownMenu
    v-if="mode === 'popper'"
    :open="isOpen"
    :modal="modal"
    @update:open="setOpen"
  >
    <slot />
  </DropdownMenu>
  <Drawer
    v-else
    :open="isOpen"
    :modal="modal"
    @update:open="setOpen"
  >
    <slot />
  </Drawer>
</template>
