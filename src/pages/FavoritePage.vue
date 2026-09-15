<template>
  <div
    class="track-list-grid flex-1 min-h-0"
  >
    <template v-if="isLoading">
      <div class="flex h-full items-center justify-center">
        <Spinner class="size-8 text-muted-foreground" />
      </div>
    </template>

    <template v-else-if="isError">
      <PageErrorState
        :message="$t('errors.loadFailed')"
        @retry="refetch"
      />
    </template>

    <template v-else>
      <TrackContextMenu context="liked">
        <VirtualScrollable
          ref="scrollableRef"
          :items="tracks"
          :get-item-key="getTrackKey"
          :item-height="56"
          :load-more-offset="120"
          :padding-top="16"
          :padding-bottom="16"
          sticky-offset="72px"
          :loading="isLoading || isFetchingNextPage"
          class="h-full"
          @load-more="handleLoadMore"
        >
          <template #before>
            <MediaHero
              v-model:filter="searchQuery"
              :data="likedData"
              :has-tracks="tracks.length > 0"
              filterable
              @play="playAll"
              @shuffle="shuffle"
              @add-to-queue="addToQueue"
            />
          </template>

          <template #leading>
            <div class="px-4">
              <AddTrackRow @add="openAddTracksPanel" />
            </div>
          </template>

          <template #sticky>
            <LibrarySortHeader
              v-model:sort-key="sortKey"
            />
          </template>

          <template #default="{ item, index }">
            <div
              class="px-4"
            >
              <TrackExpanded
                :track="item"
                :index="index + 1"
                :is-active="currentTrackId === item.id"
                menu-target="liked"
                @play="playTrack(index)"
                @contextmenu="handleContextMenu(item, index)"
              />
            </div>
          </template>

          <template #loader>
            <div class="flex items-center px-4 flex-col w-full">
              <TrackRowLoading />
            </div>
          </template>
        </VirtualScrollable>
      </TrackContextMenu>

      <TrackDropdown context="liked" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useRoute } from "vue-router";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import { useScrollRestoration } from "@/components/ui/scrollable/useScrollRestoration";
import PageErrorState from "@/components/common/PageErrorState.vue";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { Spinner } from "@/components/ui/spinner";
import { useLikedTracksPage } from "@/modules/favorite/composables/useLikedTracksPage";
import { getLikedTracksPageData, searchLikedTracks } from "@/queries/track.queries";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import type { TrackSortKey } from "@/modules/tracks/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { Track } from "@/modules/player/types";
import LibrarySortHeader from "@/modules/library/components/LibrarySortHeader.vue";
import TrackExpanded from "@/modules/tracks/components/TrackExpanded.vue";
import AddTrackRow from "@/modules/tracks/components/AddTrackRow.vue";
import { useEntityPlayback } from "@/modules/queue/composables/useEntityPlayback";
import { getLogger } from "@/lib/logger";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";

const playerStore = usePlayerStore();
const rightPanelStore = useRightPanelStore();
const { openMenu } = useTrackMenu();
const route = useRoute();
const sortKey = ref<TrackSortKey | null>(null);
const searchQuery = ref("");

const {
  tracks,
  normalizedSearchQuery,
  likedData,
  isLoading,
  isError,
  refetch,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useLikedTracksPage(sortKey, searchQuery);

// The queue takes what the page shows: every liked row, or the filter's matches.
const loadShownTracks = async () => {
  const query = normalizedSearchQuery.value;
  if (query) return (await searchLikedTracks(query, 0, Infinity, sortKey.value)).tracks;
  return (await getLikedTracksPageData(sortKey.value)).tracks;
};

const { playAll, playTrack, shuffle, addToQueue } = useEntityPlayback({
  tracks,
  source: { type: "liked" },
  isComplete: computed(() => !hasNextPage.value),
  loadAll: loadShownTracks,
});

const currentTrackId = computed(() => playerStore.currentTrack?.id ?? null);

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function openAddTracksPanel() {
  rightPanelStore.openAddTracks({
    entityType: "favorite",
    entityId: "favorites",
    onConfirmed: () => refetch(),
  }, {
    scope: { type: "route", routeKey: route.fullPath },
    depth: 1,
  });
}

function handleLoadMore() {
  if (!hasNextPage.value || isFetchingNextPage.value) return;
  // The query keeps its own error state for the UI; the log is what tells us
  // WHY a scroll stopped loading more liked tracks.
  fetchNextPage().catch((error: unknown) => {
    getLogger().warn(`[FavoritePage] Loading the next liked tracks page failed: ${String(error)}`);
  });
}

function handleContextMenu(track: Track, index: number) {
  openMenu(track, index, { target: "liked" });
}

const scrollableRef = useTemplateRef("scrollableRef");
// Declared after the page state it reads: the hook evaluates `ready`
// immediately, so placing this any earlier hits the temporal dead zone.
// A sort only reorders the list, so the scroll stays put; a search shows
// another list and gets its own position.
useScrollRestoration(scrollableRef, {
  key: () => `liked:${normalizedSearchQuery.value}`,
  ready: () => !isLoading.value,
  deps: () => tracks.value.length,
});
</script>
