<template>
  <aside
    v-if="sidebar.isOpen"
    class="sidebar-wrapper border-r border-background"
    :class="{ 'is-resizing': isResizing }"
    :style="{ width: `${sidebar.width}px` }"
  >
    <div class="sidebar-content">
      <div class="sidebar-header" />

      <nav class="sidebar-nav">
        <slot />
      </nav>
    </div>

    <button
      type="button"
      class="resize-handle"
      aria-label="Resize sidebar"
      @mousedown="startResize"
      @touchstart="startResizeTouch"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useEventListener } from "@vueuse/core";
import { useSidebar } from "@/composables/useSidebar";

const { leftSidebar: sidebar, setLeftSidebarWidth } = useSidebar();

const MIN_WIDTH = 280;
const MAX_WIDTH = 400;

const isResizing = ref(false);
let startX = 0;
let startWidth = 0;

const cleanupListeners: Array<() => void> = [];

function startResize(e: MouseEvent) {
  e.preventDefault();
  isResizing.value = true;
  startX = e.clientX;
  startWidth = sidebar.value.width;

  cleanupListeners.push(
    useEventListener(document, "mousemove", handleResize),
    useEventListener(document, "mouseup", stopResize),
  );

  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
}

function startResizeTouch(e: TouchEvent) {
  if (e.touches.length !== 1) return;

  isResizing.value = true;
  startX = e.touches[0].clientX;
  startWidth = sidebar.value.width;

  cleanupListeners.push(
    useEventListener(document, "touchmove", handleResizeTouch, { passive: false }),
    useEventListener(document, "touchend", stopResize),
    useEventListener(document, "touchcancel", stopResize),
  );
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value) return;
  updateWidth(e.clientX);
}

function handleResizeTouch(e: TouchEvent) {
  if (!isResizing.value || e.touches.length !== 1) return;
  if (e.cancelable) e.preventDefault();
  updateWidth(e.touches[0].clientX);
}

function updateWidth(clientX: number) {
  const delta = clientX - startX;
  const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
  setLeftSidebarWidth(newWidth);
}

function stopResize() {
  if (!isResizing.value) return;

  isResizing.value = false;
  cleanupListeners.forEach(cleanup => cleanup());
  cleanupListeners.length = 0;

  document.body.style.cursor = "";
  document.body.style.userSelect = "";
}

onUnmounted(() => {
  stopResize();
});
</script>

<style scoped>
.sidebar-wrapper {
  position: relative;
  flex-shrink: 0;
  height: 100%;
  background: var(--card);
  display: flex;
  transition: none;
  will-change: width;
}

.sidebar-wrapper.is-resizing {
  user-select: none;
}

.sidebar-content {
  flex: 1;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sidebar-header {
  flex-shrink: 0;
}

.sidebar-nav {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background-color 0.2s;
  touch-action: none;
  z-index: 20;
  border: none;
  padding: 0;
}

.resize-handle:hover,
.resize-handle:active {
  background: var(--primary);
}

.resize-handle::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
