<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { type InputGroupAddonVariants, inputGroupAddonVariants } from ".";

const props = withDefaults(
  defineProps<{
    align?: NonNullable<InputGroupAddonVariants["align"]>;
    class?: HTMLAttributes["class"];
  }>(),
  { align: "inline-start" },
);

const focusControl = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) return;
  const group = (event.currentTarget as HTMLElement).closest("[data-slot=input-group]");
  group
    ?.querySelector<HTMLElement>(
      "[data-slot=input-group-control]:is(input, textarea), [data-slot=input-group-control] [role=spinbutton]",
    )
    ?.focus();
};
</script>

<template>
  <div
    data-slot="input-group-addon"
    :data-align="props.align"
    :class="cn(inputGroupAddonVariants({ align: props.align }), props.class)"
    @click="focusControl"
  >
    <slot />
  </div>
</template>
