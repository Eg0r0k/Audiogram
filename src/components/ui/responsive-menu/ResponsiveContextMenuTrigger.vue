<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch, watchEffect } from "vue";
import { useResponsiveMenu } from "./context";

const props = withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const menu = useResponsiveMenu();

// The popper menu listens on this wrapper itself, right-click and long press alike.
const wrapper = useTemplateRef<HTMLElement>("wrapper");
watch(wrapper, (element) => {
  menu.trigger.value = element;
}, { immediate: true, flush: "sync" });
watchEffect(() => {
  menu.triggerDisabled.value = props.disabled;
});
onBeforeUnmount(() => {
  menu.trigger.value = null;
});

const onContextMenu = (event: MouseEvent) => {
  if (menu.mode.value === "popper" || props.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  menu.setOpen(true);
};
</script>

<template>
  <div
    ref="wrapper"
    role="presentation"
    class="contents"
    @contextmenu="onContextMenu"
  >
    <slot />
  </div>
</template>
