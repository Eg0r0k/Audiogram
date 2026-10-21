<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { DrawerMenu } from "@/components/ui/drawer-menu";
import { Menu, type MenuPosition } from "@/components/ui/menu";
import { useResponsiveMenu } from "./context";

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  side?: Side;
  align?: Align;
  sideOffset?: number;
  title?: string;
}>();

const menu = useResponsiveMenu();

const open = computed({
  get: () => menu.isOpen.value,
  set: menu.setOpen,
});

const horizontal = { start: "start", center: "middle", end: "end" } as const;
const vertical = { start: "top", center: "center", end: "bottom" } as const;
const opposite = { top: "bottom", bottom: "top", left: "end", right: "start" } as const;

// Popper side/align in the anchor/self terms Menu places by: the menu's `self`
// point meets the trigger's `anchor` point.
const placement = computed((): { anchor: MenuPosition; self: MenuPosition; offset?: [number, number] } => {
  const side = props.side ?? "bottom";
  const align = props.align ?? "start";
  const gap = props.sideOffset;
  if (side === "top" || side === "bottom") {
    return {
      anchor: `${side} ${horizontal[align]}`,
      self: `${opposite[side]} ${horizontal[align]}`,
      offset: gap === undefined ? undefined : [0, gap],
    };
  }
  const edge = side === "left" ? "start" : "end";
  return {
    anchor: `${vertical[align]} ${edge}`,
    self: `${vertical[align]} ${opposite[side]}`,
    offset: gap === undefined ? undefined : [gap, 0],
  };
});
</script>

<template>
  <Menu
    v-if="menu.mode.value === 'popper'"
    v-model="open"
    :target="menu.trigger.value ?? false"
    :context-menu="menu.kind === 'context'"
    :no-parent-event="menu.triggerDisabled.value"
    :modal="menu.modal.value"
    :anchor="menu.kind === 'context' ? undefined : placement.anchor"
    :self="menu.kind === 'context' ? undefined : placement.self"
    :offset="menu.kind === 'context' ? undefined : placement.offset"
    :class="props.class"
  >
    <slot />
  </Menu>
  <DrawerContent v-else>
    <slot name="header">
      <DrawerTitle class="sr-only">
        {{ props.title ?? $t("common.menuTitle") }}
      </DrawerTitle>
    </slot>
    <DrawerMenu>
      <slot />
    </DrawerMenu>
  </DrawerContent>
</template>
