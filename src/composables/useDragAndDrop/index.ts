// composables/useDragAndDrop/index.ts
import { reactive } from "vue";
import type { DragItem, DragState, DropTarget } from "./types";

// ═══════════════════════════════════════════════════════════════
// Глобальный синглтон (НЕ provide/inject)
// ═══════════════════════════════════════════════════════════════

const state = reactive<DragState>({
  isDragging: false,
  item: null,
  position: { x: 0, y: 0 },
  activeDropZone: null,
});

const dropZones = reactive(new Map<string, DropTarget>());

function startDrag(item: DragItem, event: DragEvent) {
  console.log("startDrag called:", item);

  state.isDragging = true;
  state.item = item;
  state.position = { x: event.clientX, y: event.clientY };

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(item));

    const emptyImg = new Image();
    emptyImg.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    event.dataTransfer.setDragImage(emptyImg, 0, 0);
  }

  document.addEventListener("dragover", updatePosition);
  document.addEventListener("dragend", handleDragEnd);
}

function updatePosition(event: DragEvent) {
  state.position = { x: event.clientX, y: event.clientY };
}

function handleDragEnd() {
  endDrag();
}

function endDrag() {
  state.isDragging = false;
  state.item = null;
  state.activeDropZone = null;

  document.removeEventListener("dragover", updatePosition);
  document.removeEventListener("dragend", handleDragEnd);
}

function registerDropZone(id: string, target: DropTarget) {
  dropZones.set(id, target);
}

function unregisterDropZone(id: string) {
  dropZones.delete(id);
}

function setActiveDropZone(id: string | null) {
  state.activeDropZone = id;
}

function canDrop(zoneId: string): boolean {
  if (!state.item) return false;
  const zone = dropZones.get(zoneId);
  if (!zone) return false;
  return zone.accepts.includes(state.item.type);
}

// ═══════════════════════════════════════════════════════════════
// Единый composable - всегда возвращает один и тот же state
// ═══════════════════════════════════════════════════════════════

export function useDragAndDrop() {
  return {
    state,
    dropZones,
    startDrag,
    endDrag,
    registerDropZone,
    unregisterDropZone,
    setActiveDropZone,
    canDrop,
  };
}

export * from "./types";
