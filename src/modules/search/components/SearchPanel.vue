<template>
  <Transition
    enter-active-class="transition-transform duration-200 ease-standard"
    enter-from-class="translate-x-full"
    leave-active-class="transition-transform duration-200 ease-standard"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="isSearchOpen"
      class="absolute inset-0 top-[72px] z-20 flex flex-col bg-card overflow-hidden"
    >
      <SearchFilters
        :active-filter="activeFilter"
        :available-filters="availableFilters"
        @update:filter="setFilter($event)"
      />

      <Scrollable class="flex-1 min-h-0">
        <SearchLoading v-if="isSearching" />

        <div
          v-else-if="!hasQuery"
          class="flex flex-col py-6 gap-4 px-4 pt-0"
        >
          <SearchRecentQueries
            v-if="recentQueries.length"
            :items="recentQueries"
            @apply="applyHistoryItem"
            @remove="removeHistoryItem"
            @clear="clearHistory"
          />
          <SearchEmptyPlaceholder />
        </div>

        <SearchNoResults
          v-else-if="!hasResults"
          :query="query"
        />

        <SearchResults
          v-else
          :active-filter="activeFilter"
          :top-results="topResults"
          :track-results="trackResults"
          :artist-results="artistResults"
          :album-results="albumResults"
          :playlist-results="playlistResults"
          :filtered-results="filteredResults"
          :filtered-track-rows="filteredTrackRows"
          @navigate="navigate"
          @play-tracks="playTracks"
        />
      </Scrollable>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useSearch } from "@/modules/search/composables/useSearch";
import type { SearchResultItem } from "@/modules/search/types";
import type { Track } from "@/modules/player/types";
import { Scrollable } from "@/components/ui/scrollable";
import SearchFilters from "@/modules/search/components/SearchFilters.vue";
import SearchLoading from "@/modules/search/components/SearchLoading.vue";
import SearchEmptyPlaceholder from "@/modules/search/components/SearchEmptyPlaceholder.vue";
import SearchNoResults from "@/modules/search/components/SearchNoResults.vue";
import SearchRecentQueries from "@/modules/search/components/SearchRecentQueries.vue";
import SearchResults from "@/modules/search/components/SearchResults.vue";
import { routeLocation } from "@/app/router/route-locations";

const router = useRouter();
const queueStore = useQueueStore();

const {
  query,
  activeFilter,
  availableFilters,
  recentQueries,
  results,
  isSearching,
  isSearchOpen,
  hasQuery,
  setFilter,
  saveQueryToHistory,
  removeHistoryItem,
  clearHistory,
  applyHistoryItem,
} = useSearch();

const topResults = computed(() => results.value.topResults);
const trackResults = computed(() => results.value.groups.track);
const artistResults = computed(() => results.value.groups.artist);
const albumResults = computed(() => results.value.groups.album);
const playlistResults = computed(() => results.value.groups.playlist);

const hasResults = computed(() => {
  if (results.value.topResults.length > 0) return true;
  const groups = results.value.groups;
  return groups.track.length > 0 || groups.artist.length > 0 || groups.album.length > 0 || groups.playlist.length > 0;
});

const filteredResults = computed(() => {
  if (activeFilter.value === "all") return results.value.topResults;
  return results.value.groups[activeFilter.value] ?? [];
});

const filteredTrackRows = computed(() =>
  filteredResults.value.flatMap(item => item.track ? [item.track] : []),
);

function navigate(item: SearchResultItem) {
  saveQueryToHistory();
  switch (item.type) {
    case "artist":
      router.push(routeLocation.artist(item.entityId));
      break;
    case "album":
      router.push(routeLocation.album(item.entityId));
      break;
    case "playlist":
      router.push(routeLocation.playlist(item.entityId));
      break;
    case "track":
      if (item.track) {
        void playTracks([item.track], 0);
      }
      break;
  }
}

async function playTracks(tracks: Track[], index: number) {
  if (tracks.length === 0) return;
  saveQueryToHistory();
  await queueStore.setQueue(tracks, index, { type: "search" });
}
</script>
