<template>
  <div :class="wrapperClasses">
    <ScrollableThumb
      v-if="scrollable.USE_OWN_SCROLL && !hideThumb"
      :scrollable="scrollable"
      :direction="direction"
    />

    <div
      ref="containerRef"
      :class="containerClasses"
      @scroll="handleScrollEmit"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, useTemplateRef, watch } from "vue";
import { scrollableInjectionKey } from "./injection";
import { isScrollLockedByOverlay } from "./scroll-lock";
import ScrollableThumb from "./ScrollableThumb.vue";
import useScrollable from "./useScrollable";
import "./scrollable.css";

interface Props {
  direction?: "vertical" | "horizontal";
  onScrollOffset?: number;
  bordered?: boolean;
  hideThumb?: boolean;
  fitContent?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  direction: "vertical",
  onScrollOffset: 300,
  bordered: false,
  hideThumb: false,
  fitContent: false,
});

const emit = defineEmits<{
  scroll: [event: Event];
  scrolledTop: [];
  scrolledBottom: [];
}>();

const containerRef = useTemplateRef("containerRef");

const scrollable = useScrollable(containerRef, {
  direction: () => props.direction,
  onScrollOffset: () => props.onScrollOffset,
  onScrolledTop: () => emit("scrolledTop"),
  onScrolledBottom: () => emit("scrolledBottom"),
});

watch(isScrollLockedByOverlay, locked => scrollable.setScrollLocked(locked));

// See VirtualScrollable: one programmatic move must not read as a user scroll.
let skipNextScroll = false;

const setScrollPositionSilently = (offset: number) => {
  const container = containerRef.value;
  if (!container) return;
  const axis = props.direction === "vertical" ? "scrollTop" : "scrollLeft";
  if (container[axis] === offset) return;
  skipNextScroll = true;
  scrollable.setScrollPositionSilently(offset);
  requestAnimationFrame(() => {
    skipNextScroll = false;
  });
};

function handleScrollEmit(e: Event) {
  scrollable.updateThumb();
  if (skipNextScroll) {
    skipNextScroll = false;
    return;
  }
  emit("scroll", e);
}

const sizingClass = computed(() => {
  if (props.direction === "horizontal") return "scrollable-direction-x";
  return props.fitContent ? "scrollable-fit" : "scrollable-direction-y";
});

const wrapperClasses = computed(() => [
  "scrollable-wrapper",
  sizingClass.value,
  {
    "scrollable-y-bordered": props.bordered && props.direction === "vertical",
    "scrolled-start": props.bordered && scrollable.isScrolledToStart.value,
    "scrolled-end": props.bordered && scrollable.isScrolledToEnd.value,
  },
]);

const containerClasses = computed(() => [
  "scrollable",
  props.direction === "vertical" ? "scrollable-y" : "scrollable-x",
  {
    "no-scrollbar": scrollable.USE_OWN_SCROLL,
    "no-scrollbar-safari": scrollable.IS_SAFARI && !scrollable.IS_MOBILE_SAFARI,
  },
]);

provide(scrollableInjectionKey, scrollable);

defineExpose({
  scrollTo: scrollable.scrollTo,
  scrollToEnd: scrollable.scrollToEnd,
  scrollToStart: scrollable.scrollToStart,
  scrollPosition: scrollable.scrollPosition,
  setScrollPositionSilently,
  isScrolledToEnd: scrollable.isScrolledToEnd,
  isScrolledToStart: scrollable.isScrolledToStart,
  container: containerRef,
  USE_OWN_SCROLL: scrollable.USE_OWN_SCROLL,
});
</script>

<style>
html.overlay-scroll .scrollable::-webkit-scrollbar {
  width: 0;
  height: 0;
  opacity: 0;
  width: 0.375rem;
}

html.overlay-scroll .scrollable::-webkit-scrollbar-thumb {
  width: 0;
  height: 0;
  opacity: 0;
  transition: 0.2s ease-in-out;
}

html.overlay-scroll .scrollable::-webkit-scrollbar-button {
  width: 0;
  height: 0;
  display: none;
}

.scrollable {
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow-y: hidden;
  overflow-x: hidden;
  position: absolute;
  inset: 0;
  overflow-anchor: none;
  -webkit-overflow-scrolling: touch;
}

/* A flex column, so a wrapper capped by its max-height or by a flex parent
   shrinks the in-flow container below its content and it scrolls. */
.scrollable-fit {
  display: flex;
  flex-direction: column;
}
.scrollable-fit > .scrollable {
  position: relative;
  inset: auto;
  height: auto;
  min-height: 0;
  max-height: none;
}
.scrollable-fit > .scrollable-thumb-container-y {
  align-self: flex-end;
}

.scrollable::-webkit-scrollbar {
  width: 0;
  height: 0;
  opacity: 0;
  width: 0.375rem;
}

.scrollable::-webkit-scrollbar-thumb {
  width: 0;
  height: 0;
  opacity: 0;
  transition: 0.2s ease-in-out;
}

.scrollable::-webkit-scrollbar-thumb {
  opacity: 0;
  transition: 0.2s ease-in-out;
}

.scrollable::-webkit-scrollbar-button {
  width: 0;
  height: 0;
  display: none;
}

.scrollable-y {
  overflow-x: hidden;
  overflow-y: auto;
  overflow-y: overlay;
  scrollbar-width: none;
  overscroll-behavior-y: contain;
}

/* MobileLayout sets the inset to the height of the floating mini-player + nav
   dock so the last rows can scroll out from under it; 0 elsewhere. Only the
   innermost vertical scroller pads: on nested pages (home wraps the sidebar
   list) padding the outer one would push the page's own background up and
   leave a bare strip under the dock. */
.scrollable-y:not(:has(.scrollable-y)) {
  padding-bottom: var(--mobile-bottom-inset, 0px);
}

.scrollable-x {
  position: relative;
  inset: auto;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
  white-space: nowrap;
}

.scrollable-thumb {
  position: absolute;
  width: 5px;
  background: var(--color-muted-foreground);
  border-radius: 3px;
  pointer-events: auto;
  cursor: default;
  opacity: 0;
  transition: opacity 0.1s ease-in-out;
  inset-inline-end: 1px;
}

.scrollable-thumb-container-y .scrollable-thumb {
  top: 0;
  right: 0;
  width: 6px;
}

.scrollable-y-bordered::before,
.scrollable-y-bordered::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border, #e0e0e0);
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
  pointer-events: none;
}

.scrollable-y-bordered::before {
  top: 0;
}

.scrollable-y-bordered::after {
  bottom: 0;
}
</style>
