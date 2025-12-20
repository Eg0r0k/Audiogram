<script setup lang="ts">
import type { RadioGroupItemProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import {
  RadioGroupIndicator,
  RadioGroupItem,
  useForwardProps,
} from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    v-bind="forwardedProps"
    :class="
      cn(
        'radio-item',
        'aspect-square size-[22px] shrink-0 rounded-full cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <RadioGroupIndicator
      data-slot="radio-group-indicator"
      class="radio-indicator"
      force-mount
    >
      <span class="radio-dot" />
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>

<style scoped>
.radio-item {
  position: relative;
  border: 2px solid var(--color-muted-foreground);
  background: transparent;
  transition: border-color 0.1s ease;
}

.radio-item[data-state="checked"] {
  border-color: var(--primary);
}

.radio-item:focus-visible {
  box-shadow: 0 0 0 3px var(--ring) / 0.5;
}

.radio-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.radio-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--primary);
  transform: scale(0);
  transform-origin: center;
  transition: transform 0.1s ease;
}

.radio-item[data-state="checked"] .radio-dot {
  transform: scale(1);
}
</style>
