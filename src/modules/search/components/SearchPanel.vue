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
      <!-- ── Filters ──────────────────────────────────────────────────── -->

      <Scrollable
        direction="horizontal"
        hide-thumb
        class="shrink-0 border-b border-background"
      >
        <Tabs
          :model-value="activeFilter"
          @update:model-value="setFilter($event as SearchFilter)"
        >
          <TabsList class="inline-flex items-center gap-0 px-4">
            <TabsTrigger
              v-for="filter in availableFilters"
              :key="filter.value"
              class=" text-base font-medium mb-0.5"
              :value="filter.value"
            >
              {{ filterLabel(filter.value) }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Scrollable>

      <!-- ── Results area ─────────────────────────────────────────────── -->
      <Scrollable class="flex-1 min-h-0">
        <!-- Loading -->
        <div
          v-if="isSearching"
          class="flex items-center justify-center py-16"
        >
          <IconLoader2 class="size-5 animate-spin text-muted-foreground" />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!hasQuery"
          class="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center"
        >
          <div class="size-12 rounded-full bg-muted flex items-center justify-center">
            <IconSearch class="size-5 text-muted-foreground" />
          </div>
          <p class="text-xs text-muted-foreground">
            {{ $t("search.placeholder") }}
          </p>
        </div>

        <!-- No results -->
        <div
          v-else-if="!hasResults"
          class="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center"
        >
          <div class="size-12 rounded-full bg-muted flex items-center justify-center">
            <IconSearchOff class="size-5 text-muted-foreground" />
          </div>
          <p class="text-xs font-medium">
            {{ $t("search.noResults.title", { query }) }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ $t("search.noResults.hint") }}
          </p>
        </div>

        <!-- Results: all filter ─ top result + tracks + artists + albums + playlists -->
        <template v-else-if="activeFilter === 'all'">
          <!-- Top result -->
          <div
            v-if="topResult"
            class="px-3 pt-3 pb-2"
          >
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
              {{ $t("search.bestResult") }}
            </p>
            <SearchDropdownRow
              :item="topResult"
              @click="navigate(topResult!)"
            />
          </div>

          <!-- Tracks -->
          <div
            v-if="trackResults.length"
            class="px-3 pb-2"
          >
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
              {{ $t("search.filter.track") }}
            </p>
            <SearchDropdownRow
              v-for="item in trackResults.slice(0, 4)"
              :key="item.id"
              :item="item"
              @click="navigate(item)"
            />
          </div>

          <!-- Artists -->
          <div
            v-if="artistResults.length"
            class="px-3 pb-2"
          >
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
              {{ $t("search.filter.artist") }}
            </p>
            <SearchDropdownRow
              v-for="item in artistResults.slice(0, 4)"
              :key="item.id"
              :item="item"
              @click="navigate(item)"
            />
          </div>

          <!-- Albums -->
          <div
            v-if="albumResults.length"
            class="px-3 pb-2"
          >
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
              {{ $t("search.filter.album") }}
            </p>
            <SearchDropdownRow
              v-for="item in albumResults.slice(0, 4)"
              :key="item.id"
              :item="item"
              @click="navigate(item)"
            />
          </div>

          <!-- Playlists -->
          <div
            v-if="playlistResults.length"
            class="px-3 pb-4"
          >
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
              {{ $t("search.filter.playlist") }}
            </p>
            <SearchDropdownRow
              v-for="item in playlistResults.slice(0, 4)"
              :key="item.id"
              :item="item"
              @click="navigate(item)"
            />
          </div>
        </template>

        <!-- Results: filtered -->
        <div
          v-else
          class="px-3 py-2 flex flex-col"
        >
          <SearchDropdownRow
            v-for="item in filteredResults"
            :key="item.id"
            :item="item"
            @click="navigate(item)"
          />
        </div>
      </Scrollable>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSearch } from "@/modules/search/composables/useSearch";
import { SEARCH_ENTITY_TYPES } from "@/modules/search/types";
import type { SearchFilter, SearchResultItem } from "@/modules/search/types";
import { Button } from "@/components/ui/button";
import SearchDropdownRow from "@/modules/search/components/SearchDropdownRow.vue";
import IconLoader2 from "~icons/tabler/loader-2";
import IconSearch from "~icons/tabler/search";
import IconSearchOff from "~icons/tabler/search-off";
import { Scrollable } from "@/components/ui/scrollable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const router = useRouter();
const { t } = useI18n();

const {
  query,
  activeFilter,
  availableFilters,
  results,
  isSearching,
  isSearchOpen,
  hasQuery,
  setFilter,
  closeSearch,
} = useSearch();

// ── Derived ───────────────────────────────────────────────────────────────────

const topResult = computed(() => results.value.topResults[0] ?? null);
const trackResults = computed(() => results.value.groups.track);
const artistResults = computed(() => results.value.groups.artist);
const albumResults = computed(() => results.value.groups.album);
const playlistResults = computed(() => results.value.groups.playlist);

const hasResults = computed(
  () =>
    results.value.topResults.length > 0
    || SEARCH_ENTITY_TYPES.some(t => results.value.groups[t].length > 0),
);

const filteredResults = computed(() => {
  if (activeFilter.value === "all") return results.value.topResults;
  return results.value.groups[activeFilter.value] ?? [];
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const filterLabels: Record<SearchFilter, string> = {
  all: t("search.filter.all"),
  track: t("search.filter.track"),
  artist: t("library.filterArtists"),
  album: t("library.filterAlbums"),
  playlist: t("library.filterPlaylists"),
};

function filterLabel(value: SearchFilter) {
  return filterLabels[value] ?? value;
}

function navigate(item: SearchResultItem) {
  closeSearch();
  switch (item.type) {
    case "artist":
      router.push({ name: "artist", params: { id: item.entityId } });
      break;
    case "album":
      router.push({ name: "album", params: { id: item.entityId } });
      break;
    case "playlist":
      router.push({ name: "playlist", params: { id: item.entityId } });
      break;
    case "track":
      // TODO: play track
      break;
  }
}
</script>
