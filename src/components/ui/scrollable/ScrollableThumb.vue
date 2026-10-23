<template>
  <div
    v-if="scrollable.thumbSize.value > 0"
    class="scrollable-thumb-container"
    :class="direction === 'horizontal' ? 'scrollable-thumb-container-x' : 'scrollable-thumb-container-y'"
  >
    <div
      class="scrollable-thumb"
      :class="{ 'is-focused': scrollable.isDragging.value }"
      :style="thumbStyle"
      @mousedown="scrollable.handleThumbMouseDown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ScrollableContext } from "./injection";

interface Props {
  scrollable: Pick<ScrollableContext, "thumbSize" | "thumbPosition" | "isDragging" | "handleThumbMouseDown">;
  direction: "vertical" | "horizontal";
}

const props = defineProps<Props>();

const thumbStyle = computed(() => {
  const size = `${props.scrollable.thumbSize.value}px`;
  const offset = `${props.scrollable.thumbPosition.value}px`;
  return props.direction === "vertical"
    ? { height: size, transform: `translateY(${offset})` }
    : { width: size, transform: `translateX(${offset})` };
});
</script>
