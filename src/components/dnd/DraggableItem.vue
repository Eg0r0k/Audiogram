<template>
  <component
    :is="as"
    draggable="true"
    :class="['draggable-item', { 'draggable-item--dragging': isDragging }]"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <slot :is-dragging="isDragging" />
  </component>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useDragAndDrop, type DragItem } from "@/composables/useDragAndDrop";

interface Props {
  as?: string | object;
  item: DragItem;
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
});

const { startDrag, endDrag } = useDragAndDrop();
const isDragging = ref(false);

function onDragStart(event: DragEvent) {
  isDragging.value = true;
  startDrag(props.item, event);
}

function onDragEnd() {
  isDragging.value = false;
  endDrag();
}
</script>
<style scoped>
.draggable-item {
  cursor: grab;
  user-select: none;
}

.draggable-item:active {
  cursor: grabbing;
}

.draggable-item--dragging {
  opacity: 0.5;
}
</style>
