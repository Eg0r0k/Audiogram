<!-- eslint-disable vue/require-default-prop -->
<script setup lang="ts">
import type { DropdownMenuContentProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { ContextMenuContent } from "@/components/ui/context-menu";
import { DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { Scrollable } from "@/components/ui/scrollable";
import { useResponsiveMenu } from "./context";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  side?: DropdownMenuContentProps["side"];
  align?: DropdownMenuContentProps["align"];
  sideOffset?: DropdownMenuContentProps["sideOffset"];
  title?: string;
}>();

const menu = useResponsiveMenu();

const placement = computed(() => ({
  side: props.side,
  align: props.align,
  sideOffset: props.sideOffset,
}));
</script>

<template>
  <template v-if="menu.mode.value === 'popper'">
    <ContextMenuContent
      v-if="menu.kind === 'context'"
      :class="props.class"
    >
      <slot />
    </ContextMenuContent>
    <DropdownMenuContent
      v-else
      :class="props.class"
      v-bind="placement"
    >
      <slot />
    </DropdownMenuContent>
  </template>
  <DrawerContent v-else>
    <slot name="header">
      <DrawerTitle class="sr-only">
        {{ props.title ?? $t("common.menuTitle") }}
      </DrawerTitle>
    </slot>
    <Scrollable class="sheet-scroll min-h-0 flex-auto">
      <div class="px-2 pt-1">
        <slot />
      </div>
    </Scrollable>
  </DrawerContent>
</template>

<style scoped>
/* Scrollable positions its scroller absolutely and sizes it in percent of a
   sized parent; a sheet is sized by its content, where percentages resolve
   to nothing. In flow as a shrinkable flex item the scroller grows with the
   menu and only scrolls once the sheet hits its height cap. */
.sheet-scroll {
  display: flex;
  flex-direction: column;
}
.sheet-scroll :deep(.scrollable) {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  max-height: none;
}
</style>
