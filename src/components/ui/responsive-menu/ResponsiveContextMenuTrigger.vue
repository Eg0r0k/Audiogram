<script setup lang="ts">
import { ContextMenuTrigger } from "@/components/ui/context-menu";
import { useResponsiveMenu } from "./context";

const props = withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const menu = useResponsiveMenu();

const onContextMenu = (event: MouseEvent) => {
  if (props.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  menu.setOpen(true);
};
</script>

<template>
  <ContextMenuTrigger
    v-if="menu.mode.value === 'popper'"
    as-child
    :disabled="props.disabled"
  >
    <slot />
  </ContextMenuTrigger>
  <div
    v-else
    role="presentation"
    class="contents"
    @contextmenu="onContextMenu"
  >
    <slot />
  </div>
</template>
