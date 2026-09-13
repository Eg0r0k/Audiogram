<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed, useAttrs } from "vue";
import { cn } from "@/lib/utils";
import { useDrawerMenuClose } from "./context";
import { drawerMenuRowClass } from "./row";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"];
  variant?: "default" | "destructive";
  disabled?: boolean;
}>(), {
  class: undefined,
  variant: "default",
  disabled: false,
});

type Handler = (event: Event) => void;

const attrs = useAttrs();
const close = useDrawerMenuClose();

const passthrough = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "onClick" && key !== "onSelect")),
);

const handlersOf = (raw: unknown): Handler[] => {
  if (Array.isArray(raw)) return raw as Handler[];
  return typeof raw === "function" ? [raw as Handler] : [];
};

// Popper items fire `select`, plain buttons fire `click`; consumers use either,
// so both run here, then the sheet closes (a menu item selects, then dismisses).
const onClick = (event: MouseEvent) => {
  if (props.disabled) return;
  for (const fn of [...handlersOf(attrs.onClick), ...handlersOf(attrs.onSelect)]) fn(event);
  close();
};
</script>

<template>
  <button
    v-ripple
    type="button"
    data-slot="drawer-menu-item"
    :data-variant="variant"
    :disabled="disabled || undefined"
    v-bind="passthrough"
    :class="cn(
      drawerMenuRowClass,
      'data-[variant=destructive]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive',
      'data-[variant=destructive]:hover:bg-destructive/10 data-[variant=destructive]:active:bg-destructive/10 dark:data-[variant=destructive]:hover:bg-destructive/20 dark:data-[variant=destructive]:active:bg-destructive/20',
      props.class,
    )"
    @click="onClick"
  >
    <slot />
  </button>
</template>
