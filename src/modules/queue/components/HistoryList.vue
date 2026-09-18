<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <CrossfadeTransition class="flex-1">
      <div
        v-if="isLoading"
        class="flex items-center justify-center bg-card mt-2"
      >
        <Spinner class="size-10 text-muted-foreground" />
      </div>

      <HistoryEmpty v-else-if="isEmpty" />

      <div
        v-else
        class="flex min-h-0 flex-col"
      >
        <div class="flex items-center justify-between gap-2 px-4 pt-2 mt-2 bg-card font-medium">
          <span class="min-w-0 truncate">{{ t("queue.tabHistory") }}</span>
          <Button
            variant="ghost-primary"
            size="sm"
            class="shrink-0"
            @click="clearHistory"
          >
            <IconTrash />
            {{ t("queue.clearHistory") }}
          </Button>
        </div>

        <TrackContextMenu context="history">
          <VirtualScrollable
            :items="entries"
            :estimate-size="ITEM_HEIGHT"
            :item-height="ITEM_HEIGHT"
            :overscan="6"
            :padding-top="8"
            :padding-bottom="8"
            :get-item-key="getItemKey"
            animate-reorder
            class="flex-1 bg-card"
          >
            <template #default="{ item, index }">
              <div class="px-4">
                <TrackRow
                  hide-index
                  menu-target="history"
                  :track="(item as RecentHistoryEntry).track"
                  @play="handlePlayTrack(index)"
                />
              </div>
            </template>
          </VirtualScrollable>
        </TrackContextMenu>

        <TrackDropdown context="history" />
      </div>
    </CrossfadeTransition>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import CrossfadeTransition from "@/components/transitions/CrossfadeTransition.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useClearHistory } from "@/composables/useClearHistory";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import HistoryEmpty from "./HistoryEmpty.vue";
import { useHistoryList } from "../composables/useHistoryList";
import { useQueueStore } from "../store/queue.store";
import type { RecentHistoryEntry } from "@/queries/stats.queries";
import IconTrash from "~icons/tabler/trash";
const ITEM_HEIGHT = 64;

const { t } = useI18n();
const queueStore = useQueueStore();
const { entries, isEmpty, isLoading } = useHistoryList();
const { clearHistory } = useClearHistory();

function getItemKey(index: number): string | number {
  return entries.value[index]?.eventId ?? index;
}

async function handlePlayTrack(index: number) {
  const tracks = entries.value.map(entry => entry.track);
  if (tracks.length === 0) return;

  await queueStore.setQueue(tracks, index, { type: "history" });
}
</script>
