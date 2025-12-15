<template>
  <div
    ref="wrapperRef"
    :class="wrapperClasses"
  >
    <div
      v-if="scrollable.USE_OWN_SCROLL && showThumbVisible"
      class="scrollable-thumb-container scrollable-thumb-container-y"
    >
      <div
        ref="thumbRef"
        class="scrollable-thumb"
        :class="{ 'is-focused': scrollable.isDragging.value }"
        :style="thumbStyle"
        @mousedown="scrollable.handleThumbMouseDown"
      />
    </div>

    <div
      ref="containerRef"
      :class="containerClasses"
      @scroll="handleScroll"
    >
      <div
        :style="{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }"
      >
        <div
          v-for="virtualRow in virtualizer.getVirtualItems()"
          :key="String(virtualRow.key)"
          :ref="(el) => measureElement(el as Element | null)"
          :data-index="virtualRow.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          }"
        >
          <slot
            :item="items[virtualRow.index]"
            :index="virtualRow.index"
            :virtual-row="virtualRow"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="flex justify-center py-4"
      >
        <slot name="loader" />
      </div>

      <div
        v-if="!loading && items.length === 0"
        class="flex items-center justify-center py-8"
      >
        <slot name="empty" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { useVirtualizer } from "@tanstack/vue-virtual";
import { computed, useTemplateRef, watch } from "vue";
import useScrollable from "./useScrollable";

interface Props {
  items: T[];
  estimateSize?: number;
  itemHeight?: number;
  overscan?: number;
  getItemKey?: (index: number) => string | number;
  loading?: boolean;
  bordered?: boolean;
  hideThumb?: boolean;
  loadMoreOffset?: number;
}

const props = withDefaults(defineProps<Props>(), {
  estimateSize: 64,
  itemHeight: undefined,
  overscan: 5,
  getItemKey: (index: number) => index,
  loading: false,
  bordered: false,
  hideThumb: false,
  loadMoreOffset: 300,
});

const emit = defineEmits<{
  scroll: [event: Event];
  scrolledTop: [];
  scrolledBottom: [];
  loadMore: [];
}>();

const containerRef = useTemplateRef("containerRef");

const scrollable = useScrollable(containerRef, {
  direction: "vertical",
  onScrollOffset: props.loadMoreOffset,
  onScrolledTop: () => emit("scrolledTop"),
  onScrolledBottom: () => {
    emit("scrolledBottom");
    emit("loadMore");
  },
});

const virtualizer = useVirtualizer({
  get count() {
    return props.items.length;
  },
  getScrollElement: () => containerRef.value,
  estimateSize: () => props.itemHeight ?? props.estimateSize,
  overscan: props.overscan,
  getItemKey: index => props.getItemKey(index),
});

const measureElement = (el: Element | null) => {
  if (el && !props.itemHeight) {
    virtualizer.value.measureElement(el);
  }
};

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const currentScrollTop = target.scrollTop;

  scrollable.updateThumb();

  const scrollHeight = target.scrollHeight;
  const clientHeight = target.clientHeight;
  const distanceToBottom = scrollHeight - currentScrollTop - clientHeight;

  if (distanceToBottom <= props.loadMoreOffset) {
    emit("loadMore");
  }

  emit("scroll", e);
};

const wrapperClasses = computed(() => [
  "scrollable-wrapper",
  "scrollable-direction-y",
  {
    "scrollable-y-bordered": props.bordered,
    "scrolled-start": props.bordered && scrollable.isScrolledToStart.value,
    "scrolled-end": props.bordered && scrollable.isScrolledToEnd.value,
  },
]);

const containerClasses = computed(() => [
  "scrollable",
  "scrollable-y",
  {
    "no-scrollbar": scrollable.USE_OWN_SCROLL,
    "no-scrollbar-safari": scrollable.IS_SAFARI && !scrollable.IS_MOBILE_SAFARI,
  },
]);

const showThumbVisible = computed(
  () => !props.hideThumb && scrollable.thumbSize.value > 0,
);

const thumbStyle = computed(() => ({
  height: `${scrollable.thumbSize.value}px`,
  transform: `translateY(${scrollable.thumbPosition.value}px)`,
}));

interface ScrollToIndexOptions {
  align?: "start" | "center" | "end" | "auto";
  behavior?: "auto" | "smooth";
}

const scrollToIndex = (index: number, options?: ScrollToIndexOptions) => {
  virtualizer.value.scrollToIndex(index, options);
};

const scrollToOffset = (offset: number, options?: { behavior?: "auto" | "smooth" }) => {
  virtualizer.value.scrollToOffset(offset, options);
};

watch(() => props.items.length, () => {
  virtualizer.value.measure();
});

defineExpose({
  scrollToIndex,
  scrollToOffset,
  scrollToEnd: scrollable.scrollToEnd,
  scrollToStart: scrollable.scrollToStart,
  scrollPosition: scrollable.scrollPosition,
  isScrolledToEnd: scrollable.isScrolledToEnd,
  isScrolledToStart: scrollable.isScrolledToStart,
  container: containerRef,
  virtualizer,
});
</script>
<style>
:root {
  --z-thumb: 100;
}

html.is-firefox .scrollable-y {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0) rgba(0, 0, 0, 0);
}

html.overlay-scroll .scrollable-y:hover {
  scrollbar-color: var(--scrollbar-color) transparent;
}

.scrollable-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
}

.scrollable-direction-y {
  height: 100%;
}
.scrollable-direction-x {
  height: auto;
}
.scrollable {
  height: 100%;
  width: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
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

.scrollable::-webkit-scrollbar-corner {
  background-color: transparent;
}

.scrollable:hover::-webkit-scrollbar {
  opacity: 1;
}

.scrollable-y {
  overflow-x: hidden;
  overflow-y: auto;
}

.scrollable-x {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  white-space: nowrap;
}

.no-scrollbar,
.scrollable.no-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.scrollable-x::-webkit-scrollbar,
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
/* Thumb */
.scrollable-thumb-container {
  position: absolute;
  z-index: var(--z-thumb);
  pointer-events: none;
}

.scrollable-thumb-container-y {
  top: 0;
  right: 2px;
  bottom: 0;
  width: 6px;
}

.scrollable-thumb-container-x {
  left: 0;
  right: 0;
  bottom: 2px;
  height: 6px;
}

.scrollable-thumb {
  position: absolute;
  background: var(--color-muted-foreground);
  border-radius: 3px;
  pointer-events: auto;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  opacity: 0;
}

.scrollable-thumb-container-y .scrollable-thumb {
  top: 0;
  right: 0;
  width: 6px;
}

.scrollable-thumb-container-x .scrollable-thumb {
  left: 0;
  bottom: 0;
  height: 6px;
}

.scrollable-wrapper:hover .scrollable-thumb,
.scrollable-thumb.is-focused {
  opacity: 1;
}

.scrollable-thumb:hover,
.scrollable-thumb.is-focused {
  background: rgba(0, 0, 0, 0.5);
}
.scrollable:hover::-webkit-scrollbar-thumb {
  min-height: 5rem;
  max-height: 12.5rem;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.5);
  opacity: 1;
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

.scrollable-y-bordered:not(.scrolled-start)::before {
  opacity: 1;
}

.scrollable-y-bordered:not(.scrolled-end)::after {
  opacity: 1;
}
</style>
