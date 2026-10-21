<script setup lang="ts">
import { type ComponentPublicInstance, onBeforeUnmount, useTemplateRef, watch } from "vue";
import { DrawerTrigger } from "@/components/ui/drawer";
import { MenuTrigger } from "@/components/ui/menu";
import { useResponsiveMenu } from "./context";

const props = withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const menu = useResponsiveMenu();

const trigger = useTemplateRef<ComponentPublicInstance>("trigger");
watch(
  () => trigger.value?.$el as Node | undefined,
  (element) => {
    menu.trigger.value = element instanceof HTMLElement ? element : null;
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => {
  menu.trigger.value = null;
});
</script>

<template>
  <MenuTrigger
    v-if="menu.mode.value === 'popper'"
    ref="trigger"
    as-child
    :disabled="props.disabled || undefined"
  >
    <slot />
  </MenuTrigger>
  <DrawerTrigger
    v-else
    as-child
    :disabled="props.disabled"
  >
    <slot />
  </DrawerTrigger>
</template>
