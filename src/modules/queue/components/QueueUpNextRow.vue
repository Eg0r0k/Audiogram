<template>
  <SwipeItem close-on-scroll>
    <SwipeActions
      side="end"
      full-swipe
    >
      <SwipeAction
        color="destructive"
        @click="remove"
      >
        <IconTrash />
        {{ $t("queue.remove") }}
      </SwipeAction>
    </SwipeActions>
    <SwipeContent class="bg-card">
      <TrackRow
        menu-target="queue"
        :track="item.track as Track"
        :index="queueIndex + 1"
        :menu-index="queueIndex"
        :queue-item-id="item.id"
        :draggable="true"
        @play="queueStore.jumpTo(queueIndex)"
      />
    </SwipeContent>
  </SwipeItem>
</template>

<script setup lang="ts">
import { SwipeAction, SwipeActions, SwipeContent, SwipeItem } from "@/components/ui/swipe-actions";
import { getLogger } from "@/lib/logger";
import type { Track } from "@/modules/player/types";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import IconTrash from "~icons/tabler/trash";
import { useQueueStore } from "../store/queue.store";
import type { QueueItem } from "../types";

// A component with plain props: the virtual list re-renders its slot on every
// scroll event, and unchanged props let Vue skip the swipe wrappers and the row.
const props = defineProps<{
  item: QueueItem;
  queueIndex: number;
}>();

const queueStore = useQueueStore();

const remove = () => {
  queueStore.removeFromQueue(props.item.id)
    .catch((error: unknown) => getLogger().error(`[Queue] Removing a queue item failed: ${String(error)}`));
};
</script>
