<template>
  <div class="flex flex-col h-full min-h-0 bg-background">
    <template v-if="!queueStore.isEmpty">
      <TrackContextMenu context="queue">
        <div class="flex flex-col flex-1 min-h-0">
          <div
            v-if="currentQueueItem"
            class="px-4 mt-2 pt-2 pb-6 bg-card"
          >
            <h3 class="mb-3 text-base font-medium">
              {{ t("queue.nowPlaying") }}
            </h3>

            <div class="relative ">
              <TrackRow
                :hide-index="true"
                menu-target="queue"
                :track="currentQueueItem.track as Track"
                :menu-index="queueStore.currentIndex"
                :queue-item-id="currentQueueItem.id"
                :highlighted="true"
                @play="queueStore.jumpTo(queueStore.currentIndex)"
              />
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 pb-3 bg-card">
            <div class="min-h-11 min-w-0 flex-1">
              <h3 class="text-base font-medium">
                {{ t("queue.upNext") }}
              </h3>
              <p
                v-if="sourceLink || !tail"
                class="flex min-w-0 items-baseline gap-1 text-sm text-muted-foreground"
              >
                <i18n-t
                  v-if="sourceLink"
                  keypath="queue.fromSource"
                  scope="global"
                  tag="span"
                  class="min-w-0 truncate"
                >
                  <template #source>
                    <Link
                      v-if="sourceLink.to"
                      :to="sourceLink.to"
                      class="font-bold text-foreground hover:underline"
                    >
                      {{ sourceLink.label }}
                    </Link>
                    <span
                      v-else
                      class="font-bold text-foreground"
                    >{{ sourceLink.label }}</span>
                  </template>
                </i18n-t>
                <template v-if="!tail">
                  <span
                    v-if="sourceLink"
                    class="shrink-0"
                  >{{ t("queue.metaSeparator") }}</span>
                  <span class="shrink-0 whitespace-nowrap">{{ t("common.tracks", upcomingTracks.length) }}</span>
                  <span class="shrink-0">{{ t("queue.metaSeparator") }}</span>
                  <span class="shrink-0 whitespace-nowrap">{{ upcomingDuration }}</span>
                </template>
              </p>
            </div>
            <Button
              variant="ghost"
              color="destructive"
              size="sm"
              class="shrink-0"
              @click="clearUpNext"
            >
              {{ t("queue.clear") }}
            </Button>
          </div>
          <div
            v-if="tail"
            class="flex-1 bg-card px-2"
          >
            <QueueTailRow :kind="tail" />
          </div>
          <QueueUpNext v-else />
        </div>
      </TrackContextMenu>
      <TrackDropdown context="queue" />
    </template>

    <QueueEmpty v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { formatTotalDuration } from "@/lib/format/time";
import { getLogger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { useQueueStore } from "../store/queue.store";
import { useQueueSourceLink } from "../composables/useQueueSourceLink";
import { resolveUpNext } from "../lib/up-next";
import type { QueueItem } from "../types";
import type { Track } from "@/types/track";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import QueueEmpty from "./QueueEmpty.vue";
import QueueTailRow from "./QueueTailRow.vue";
import QueueUpNext from "./QueueUpNext.vue";

const { t } = useI18n();

const queueStore = useQueueStore();
const { link: sourceLink } = useQueueSourceLink();

const clearUpNext = () => {
  queueStore.clearExceptCurrent()
    .catch(error => getLogger().error(`[Queue] Clearing the queue failed: ${formatError(error)}`));
};

const currentQueueItem = computed<QueueItem | null>(() => {
  if (queueStore.currentIndex < 0) return null;
  return queueStore.queue[queueStore.currentIndex] ?? null;
});

const upcomingTracks = computed(() =>
  queueStore.queue.slice(Math.max(queueStore.currentIndex + 1, 0)).map(item => item.track),
);

const upcomingDuration = computed(() =>
  formatTotalDuration(upcomingTracks.value.reduce((sum, track) => sum + (track.duration ?? 0), 0), t),
);

const tail = computed(() => {
  const next = resolveUpNext(
    queueStore.queue,
    queueStore.currentIndex,
    queueStore.repeatMode,
    queueStore.continuesAfterTail,
  );
  return next.kind === "autoplay" || next.kind === "end" ? next.kind : null;
});
</script>
