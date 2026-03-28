<template>
  <div
    ref="rootRef"
    class="flex flex-col h-full "
  >
    <QueueHeader
      :size="queueStore.size"
      :is-empty="queueStore.isEmpty"
      :is-shuffled="queueStore.isShuffled"
      @shuffle="queueStore.toggleShuffle()"
      @clear="queueStore.clear()"
    />

    <template v-if="!queueStore.isEmpty">
      <TrackContextMenu context="queue">
        <VirtualScrollable
          ref="virtualRef"
          :items="queueStore.queue"
          :estimate-size="ITEM_HEIGHT"
          :item-height="ITEM_HEIGHT"
          :overscan="4"
          :padding-bottom="8"
          :padding-top="8"
          :get-item-key="getItemKey"
          class="flex-1"
        >
          <template #default="{ item, index }">
            <div class="relative mx-2">
              <TrackRow
                :track="item.track as Track"
                :index="index + 1"
                :menu-index="index"
                :queue-item-id="item.id"
                :draggable="true"
                :highlighted="index === queueStore.currentIndex"
                :dimmed="index < queueStore.currentIndex"
                :being-dragged="drag.isDragging.value && drag.dragIndex.value === index"
                @play="queueStore.jumpTo(index)"
                @drag-start="drag.startDrag(index, $event)"
              />

              <div
                v-if="showDropIndicator(index)"
                class="absolute left-3 right-3 h-0.5 bg-primary rounded-full z-10"
                :class="dropIndicatorPosition()"
              />
            </div>
          </template>

          <template #empty>
            <QueueEmpty />
          </template>
        </VirtualScrollable>
      </TrackContextMenu>
      <TrackDropdown context="queue" />
    </template>

    <QueueEmpty v-else />

    <QueueDragOverlay
      :is-dragging="drag.isDragging.value"
      :dragged-item="draggedItem"
      :ghost-y="drag.ghostY.value"
      :container-left="containerRect.left"
      :container-width="containerRect.width"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, useTemplateRef } from "vue";
import { useElementBounding } from "@vueuse/core";
import { useQueueStore } from "../store/queue.store";
import { useDragReorder } from "../composables/useDragReorder";
import type { QueueItem } from "../types";
import type { Track } from "@/modules/player/types";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import QueueHeader from "./QueueHeader.vue";
import QueueEmpty from "./QueueEmpty.vue";
import QueueDragOverlay from "./QueueDragOverlay.vue";

const ITEM_HEIGHT = 64;

const queueStore = useQueueStore();
const virtualRef = useTemplateRef("virtualRef");
const rootRef = useTemplateRef("rootRef");

const containerRect = reactive(useElementBounding(rootRef));

const getScrollContainer = (): HTMLElement | null => {
  return (virtualRef.value as { container?: HTMLElement | null })?.container ?? null;
};

const drag = useDragReorder({
  itemCount: computed(() => queueStore.size),
  itemHeight: ITEM_HEIGHT,
  getScrollContainer,
  onReorder: (from, to) => {
    queueStore.moveTrack(from, to);
  },
});

const draggedItem = computed<QueueItem | null>(() => {
  if (!drag.isDragging.value || drag.dragIndex.value < 0) return null;
  return queueStore.queue[drag.dragIndex.value] ?? null;
});

function getItemKey(index: number): string | number {
  return queueStore.queue[index]?.id ?? index;
}

function showDropIndicator(index: number): boolean {
  if (!drag.isDragging.value) return false;
  const drop = drag.dropIndex.value;
  const from = drag.dragIndex.value;
  if (drop === from) return false;
  if (drop < from) return index === drop;
  return index === drop;
}

function dropIndicatorPosition(): string {
  const drop = drag.dropIndex.value;
  const from = drag.dragIndex.value;
  if (drop <= from) return "top-0";
  return "bottom-0";
}
</script>
