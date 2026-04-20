<template>
  <div class="flex-1 min-h-0">
    <template v-if="isLoading">
      <div class="flex h-full items-center justify-center">
        <IconLoader2 class="size-8 animate-spin text-muted-foreground" />
      </div>
    </template>

    <template v-else-if="isError">
      <div class="flex h-full flex-col items-center justify-center gap-4">
        <div class="text-center">
          <h2 class="text-2xl font-bold">
            {{ $t("errors.title") }}
          </h2>
          <p class="text-muted-foreground">
            {{ $t("errors.loadFailed") }}
          </p>
        </div>

        <Button @click="refetch">
          {{ $t("common.retry") }}
        </Button>
      </div>
    </template>

    <template v-else>
      <TrackContextMenu context="liked">
        <VirtualScrollable
          :items="tracks"
          :get-item-key="getTrackKey"
          :item-height="64"
          :load-more-offset="120"
          :padding-top="16"
          :padding-bottom="16"
          :loading="isFetchingNextPage"
          class="h-full"
          @load-more="handleLoadMore"
        >
          <template #before>
            <MediaHero
              :data="likedData"
              @play="handlePlayAll"
              @add-to-queue="handleAddToQueue"
            />
          </template>

          <template #default="{ item, index }">
            <div
              class="px-4"
            >
              <TrackRow
                :compact="isCompact"
                menu-target="liked"
                :track="item"
                :index="index + 1"
                @play="handlePlayTrack(index)"
              />
            </div>
          </template>

          <template #loader>
            <IconLoader2 class="size-5 animate-spin text-muted-foreground" />
          </template>
          <template
            #empty
          >
            <div class="p-4">
              <Button
                size="lg"
                variant="secondary"
                class=" rounded-full w-full"
              >
                <IconPlus class=" size-5" />
                Добавить
              </Button>
            </div>
          </template>
        </VirtualScrollable>
      </TrackContextMenu>

      <TrackDropdown context="liked" />
    </template>
  </div>
</template>

<script setup lang="ts">
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { Button } from "@/components/ui/button";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import IconLoader2 from "~icons/tabler/loader-2";
import IconPlus from "~icons/tabler/plus";
import { useLikedTracksPage } from "@/modules/favorite/composables/useLikedTracksPage";
import { getLikedTracksPageData } from "@/queries/track.queries";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { useLibraryView } from "@/modules/library/composables/useLibraryView";

const queueStore = useQueueStore();

const {
  tracks,
  likedData,
  isLoading,
  isError,
  refetch,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useLikedTracksPage();

const { isCompact } = useLibraryView();
function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function handleLoadMore() {
  if (!hasNextPage.value || isFetchingNextPage.value) return;
  fetchNextPage();
}

function handlePlayAll() {
  getLikedTracksPageData().then((data) => {
    if (data && data.tracks.length > 0) {
      queueStore.setQueue(data.tracks, 0, {
        type: "liked",
      });
    }
  });
}

async function handlePlayTrack(index: number) {
  const selectedTrack = tracks.value[index];
  if (!selectedTrack) return;

  const data = await getLikedTracksPageData();
  const fullIndex = data.tracks.findIndex(track => track.id === selectedTrack.id);
  if (fullIndex === -1) return;

  queueStore.setQueue(data.tracks, fullIndex, {
    type: "liked",
  });
}

function handleAddToQueue() {
  if (tracks.value.length === 0) return;
  queueStore.addMultipleToQueue(tracks.value, {
    type: "liked",
  });
}
</script>
