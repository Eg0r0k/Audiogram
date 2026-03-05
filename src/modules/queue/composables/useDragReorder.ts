import { ref, computed, onUnmounted, type Ref, type ComputedRef } from "vue";

interface DragState {
  isDragging: boolean;
  dragIndex: number;
  dropIndex: number;
  ghostY: number;
  pointerY: number;
}

interface UseDragReorderOptions {
  itemCount: ComputedRef<number> | Ref<number>;
  itemHeight: number;
  getScrollContainer: () => HTMLElement | null;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const AUTO_SCROLL_ZONE = 70;
const AUTO_SCROLL_SPEED = 8;
const DRAG_THRESHOLD = 5;

export function useDragReorder(options: UseDragReorderOptions) {
  const { itemCount, itemHeight, getScrollContainer, onReorder } = options;

  const state = ref<DragState>({
    isDragging: false,
    dragIndex: -1,
    dropIndex: -1,
    ghostY: 0,
    pointerY: 0,
  });

  let autoScrollRaf: number | null = null;
  let startPointerY = 0;
  let dragActivated = false;

  function startDrag(index: number, event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();

    startPointerY = event.clientY;
    dragActivated = false;

    state.value.dragIndex = index;
    state.value.pointerY = event.clientY;

    (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }

  function activateDrag(clientY: number) {
    dragActivated = true;
    state.value.isDragging = true;
    state.value.dropIndex = state.value.dragIndex;
    state.value.ghostY = clientY;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    startAutoScroll();
  }

  function handlePointerMove(event: PointerEvent) {
    const dy = Math.abs(event.clientY - startPointerY);

    if (!dragActivated && dy < DRAG_THRESHOLD) return;

    if (!dragActivated) {
      activateDrag(event.clientY);
    }

    state.value.pointerY = event.clientY;
    state.value.ghostY = event.clientY;

    const container = getScrollContainer();
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const relativeY = event.clientY - containerRect.top + container.scrollTop;

    let targetIndex = Math.round(relativeY / itemHeight);
    targetIndex = Math.max(0, Math.min(targetIndex, itemCount.value - 1));

    state.value.dropIndex = targetIndex;
  }

  function handlePointerUp() {
    if (dragActivated) {
      const { dragIndex, dropIndex } = state.value;

      if (dragIndex !== dropIndex && dragIndex >= 0 && dropIndex >= 0) {
        onReorder(dragIndex, dropIndex);
      }
    }

    cleanup();
  }

  function cleanup() {
    state.value.isDragging = false;
    state.value.dragIndex = -1;
    state.value.dropIndex = -1;
    dragActivated = false;

    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";

    stopAutoScroll();
  }

  function startAutoScroll() {
    const tick = () => {
      if (!state.value.isDragging) return;

      const container = getScrollContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const pointerY = state.value.pointerY;

      const distFromTop = pointerY - rect.top;
      const distFromBottom = rect.bottom - pointerY;

      if (distFromTop < AUTO_SCROLL_ZONE && distFromTop > 0) {
        const speed = (1 - distFromTop / AUTO_SCROLL_ZONE) * AUTO_SCROLL_SPEED;
        container.scrollTop -= speed;
      }
      else if (distFromBottom < AUTO_SCROLL_ZONE && distFromBottom > 0) {
        const speed = (1 - distFromBottom / AUTO_SCROLL_ZONE) * AUTO_SCROLL_SPEED;
        container.scrollTop += speed;
      }

      autoScrollRaf = requestAnimationFrame(tick);
    };

    autoScrollRaf = requestAnimationFrame(tick);
  }

  function stopAutoScroll() {
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  }

  const isDragging = computed(() => state.value.isDragging);
  const dragIndex = computed(() => state.value.dragIndex);
  const dropIndex = computed(() => state.value.dropIndex);
  const ghostY = computed(() => state.value.ghostY);

  const dropIndicatorY = computed(() => {
    if (!state.value.isDragging) return -1;
    const idx = state.value.dropIndex;
    const from = state.value.dragIndex;
    if (idx <= from) return idx * itemHeight;
    return (idx + 1) * itemHeight;
  });

  onUnmounted(cleanup);

  return {
    isDragging,
    dragIndex,
    dropIndex,
    ghostY,
    dropIndicatorY,
    startDrag,
  };
}
