<template>
  <div class="flex min-h-0 flex-1 flex-col bg-card">
    <AllMusicHeader
      v-model:search="searchQuery"
      v-model:sort-key="sortKey"
      :selecting="isSelectMode"
      :mobile="isMobileLayout"
      @back="goBack()"
      @select="enterSelection()"
      @search-escape="onSearchEscape"
    >
      <template #selection>
        <TrackSelectionBar
          :count="selectedCount"
          :all-selected="isAllSelected"
          :all-liked="allLiked"
          :busy="busy"
          :selecting-all="isSelectingAll"
          :compact="isMobileLayout"
          @exit="exitSelection"
          @select-all="selectAll"
          @deselect-all="deselectAll"
          @play="play"
          @play-next="playNext"
          @add-to-queue="addToQueue"
          @toggle-like="toggleLike"
          @create-playlist="createPlaylist"
          @add-to-playlist="addToPlaylist"
          @delete="deleteSelected"
        />
      </template>
    </AllMusicHeader>

    <TrackContextMenu context="default">
      <CrossfadeTransition class="flex-1">
        <div
          v-if="isLoading"
          class="flex flex-col px-4 pt-4"
        >
          <TrackRowLoading :rows="5" />
        </div>

        <div
          v-else-if="isError"
          class="flex flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <h2 class="text-2xl font-bold">
            {{ t('errors.tracksLoadFailed') }}
          </h2>

          <Button @click="refetch">
            {{ t('common.retry') }}
          </Button>
        </div>

        <div
          v-else
          ref="tracksListRef"
          class="track-list-grid relative flex min-h-0 flex-col"
        >
          <LibrarySortHeader
            v-if="!isMobileLayout"
            v-model:sort-key="sortKey"
            class="px-4! [--sort-header-height:42px]"
          />

          <VirtualScrollable
            ref="scrollableRef"
            :items="tracks"
            :get-item-key="getTrackKey"
            :item-height="56"
            :load-more-offset="120"
            :padding-top="8"
            :padding-bottom="8"
            :loading="isFetchingNextPage"
            class="flex-1"
            @load-more="handleLoadMore"
          >
            <template #default="{ item, index }">
              <div class="px-2">
                <TrackExpanded
                  :track="item"
                  :index="index + 1"
                  :match="matches[item.id]"
                  :is-active="currentTrackId === item.id"
                  :is-selected="isSelected(item.id)"
                  :is-selecting="isSelectMode"
                  :join-top="joinsSelectedNeighbour(index, -1)"
                  :join-bottom="joinsSelectedNeighbour(index, 1)"
                  selectable
                  @play="handlePlayTrack(index)"
                  @select="handleTrackSelect"
                />
              </div>
            </template>

            <template
              v-if="isFetchNextPageError"
              #load-more-error
            >
              <LoadMoreError @retry="handleLoadMore" />
            </template>

            <template #loader>
              <div class="flex items-center px-2 flex-col w-full">
                <TrackRowLoading />
              </div>
            </template>

            <template #empty>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia>
                    <IconSearchOff
                      v-if="normalizedSearchQuery"
                      class="size-11 text-muted-foreground"
                    />
                    <EmptyLibraryArt
                      v-else
                      class="w-56 -mb-5"
                    />
                  </EmptyMedia>
                  <EmptyTitle>{{ emptyLabel }}</EmptyTitle>
                  <EmptyDescription>{{ emptySubLabel }}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    v-if="normalizedSearchQuery"
                    variant="solid"
                    color="surface"
                    @click="searchQuery = ''"
                  >
                    <IconX class="size-4" />
                    {{ t("library.allMusic.emptyClearSearch") }}
                  </Button>
                  <Button
                    v-else
                    variant="solid"
                    color="surface"
                    @click="handleAddMusic"
                  >
                    <IconPlus class="size-4" />
                    {{ t("library.allMusic.emptyAction") }}
                  </Button>
                </EmptyContent>
              </Empty>
            </template>
          </VirtualScrollable>
        </div>
      </CrossfadeTransition>
    </TrackContextMenu>

    <TrackDropdown context="default" />
  </div>
</template>

<script setup lang="ts">
import LoadMoreError from "@/components/common/LoadMoreError.vue";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import EmptyLibraryArt from "@/modules/library/components/EmptyLibraryArt.vue";
import IconSearchOff from "~icons/tabler/search-off";
import IconPlus from "~icons/tabler/plus";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import { useScrollRestoration } from "@/components/ui/scrollable/useScrollRestoration";
import CrossfadeTransition from "@/components/transitions/CrossfadeTransition.vue";

import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import IconX from "~icons/tabler/x";

import TrackExpanded from "@/modules/tracks/components/TrackExpanded.vue";
import AllMusicHeader from "@/modules/library/components/AllMusicHeader.vue";
import LibrarySortHeader from "@/modules/library/components/LibrarySortHeader.vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { useI18n } from "vue-i18n";
import { computed, ref, useTemplateRef } from "vue";
import type { TrackSortKey } from "@/modules/tracks/types";
import { useIndexTracksPage } from "@/modules/tracks/composables/useIndexTracksPage";
import { getAllTrackIds, getAllTracksForQueue } from "@/queries/track.queries";
import { useEntityPlayback } from "@/modules/player/composables/useEntityPlayback";
import type { QueueSource } from "@/modules/queue/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useImport } from "@/modules/library/composables/useImport";
import type { Track } from "@/types/track";
import { getLogger } from "@/lib/logger";
import TrackSelectionBar from "@/modules/tracks/components/TrackSelectionBar.vue";
import { useTrackSelectionMode } from "@/modules/tracks/composables/useTrackSelectionMode";
import { useBulkTrackActions } from "@/modules/tracks/composables/useBulkTrackActions";
import { useGoBack } from "@/composables/useGoBack";
import { formatError } from "@/lib/errors";
const { t } = useI18n();
const { pickAndImport } = useImport();
const sortKey = ref<TrackSortKey | null>(null);
const searchQuery = ref("");
const {
  normalizedSearchQuery,
  resolvedSortKey,
  tracks,
  total,
  matches,
  isLoading,
  isError,
  refetch,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
} = useIndexTracksPage(sortKey, searchQuery);

const playerStore = usePlayerStore();

const currentTrackId = computed(() => playerStore.currentTrack?.id ?? null);

const tracksListRef = useTemplateRef<HTMLElement>("tracksListRef");

const {
  isSelectMode,
  isSelectingAll,
  isAllSelected,
  isSelected,
  selectedIds,
  selectedCount,
  handleTrackSelect,
  enter: enterSelection,
  exit: exitSelection,
  selectAll,
  deselectAll,
} = useTrackSelectionMode(tracks, tracksListRef, {
  getAllIds: () => getAllTrackIds(resolvedSortKey.value, normalizedSearchQuery.value),
  total,
  resetKey: computed(() => `${resolvedSortKey.value}|${normalizedSearchQuery.value}`),
});

const goBack = useGoBack();
const { isMobileLayout } = useDeviceLayout();

const joinsSelectedNeighbour = (index: number, offset: -1 | 1) => {
  const list: readonly (Track | undefined)[] = tracks.value;
  const track = list[index];
  const neighbour = index + offset >= 0 ? list[index + offset] : undefined;
  return !!track && !!neighbour && isSelected(track.id) && isSelected(neighbour.id);
};

// The input stops keydown propagation so typing never hits global hotkeys,
// which also hides Escape from the mode's window listener.
const onSearchEscape = () => {
  if (isSelectMode.value) exitSelection();
};

const {
  busy,
  allLiked,
  play,
  playNext,
  addToQueue,
  toggleLike,
  addToPlaylist,
  createPlaylist,
  deleteSelected,
} = useBulkTrackActions({
  selectedIds,
  loadedTracks: tracks,
  sortKey: resolvedSortKey,
  onDone: (action) => {
    if (action === "play" || action === "delete") exitSelection();
  },
});

const emptyLabel = computed(() =>
  normalizedSearchQuery.value
    ? t("library.allMusic.noTracksFound", { query: normalizedSearchQuery.value })
    : t("library.allMusic.empty"),
);

const emptySubLabel = computed(() =>
  normalizedSearchQuery.value
    ? t("library.allMusic.emptySearchSub")
    : t("library.allMusic.emptySub"),
);

const handleAddMusic = async () => {
  await pickAndImport({ title: t("common.import.button") });
};

function handleLoadMore() {
  if (!hasNextPage.value || isFetchingNextPage.value) return;
  // The query keeps its own error state for the UI; the log is what tells us
  // WHY a scroll stopped loading more tracks.
  fetchNextPage().catch((err: unknown) => {
    getLogger().warn(`[AllMusicPage] Loading the next tracks page failed: ${formatError(err)}`);
  });
}

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

const queueSource = computed<QueueSource>(() =>
  (normalizedSearchQuery.value ? { type: "search" } : { type: "allMedia" }),
);

// The same rules as every other list page: a fully loaded list plays by row
// index, a partial one is played from the full set in the same sort.
const { playTrack: handlePlayTrack } = useEntityPlayback({
  tracks,
  source: queueSource,
  isComplete: computed(() => !hasNextPage.value),
  loadAll: () => getAllTracksForQueue(resolvedSortKey.value, normalizedSearchQuery.value),
});

const scrollableRef = useTemplateRef("scrollableRef");

useScrollRestoration(scrollableRef, {
  key: () => `all-music:${normalizedSearchQuery.value}`,
  ready: () => !isLoading.value,
  deps: () => tracks.value.length,
});
</script>
