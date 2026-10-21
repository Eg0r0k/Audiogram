<script setup lang="ts">
import { Primitive, type PrimitiveProps, useForwardExpose } from "reka-ui";
import { type HTMLAttributes, onBeforeUnmount, watch } from "vue";

import { cn } from "@/lib/utils";
import { menuTriggers } from ".";

const props = withDefaults(defineProps<PrimitiveProps & { class?: HTMLAttributes["class"] }>(), { as: "button" });

const { forwardRef, currentElement } = useForwardExpose();

watch(
  currentElement,
  (element, previous) => {
    if (previous) menuTriggers.delete(previous);
    if (element) menuTriggers.add(element);
  },
  { flush: "sync" },
);
onBeforeUnmount(() => {
  if (currentElement.value) menuTriggers.delete(currentElement.value);
});
</script>

<template>
  <Primitive
    :ref="forwardRef"
    :as="props.as"
    :as-child="props.asChild"
    :type="props.as === 'button' && !props.asChild ? 'button' : undefined"
    data-slot="menu-trigger"
    :class="cn(props.class)"
  >
    <slot />
  </Primitive>
</template>
