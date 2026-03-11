<template>
  <Scrollable class="flex-1">
    <LibraryHeader
      :search-query="searchQuery"
      @create-playlist="createPlaylist"
      @search="setSearchQuery"
    />

    <LibraryToolbar
      :active-filter="activeFilter"
      :sort-by="sortBy"
      @filter="handleFilter"
      @sort="setSortBy"
    />

    <LibraryGrid
      :pinned="pinnedItems"
      :unpinned="unpinnedItems"
      :is-loading="isLoading"
      @play="handlePlay"
      @contextmenu="handleContextMenu"
    />
  </Scrollable>
</template>

<script setup lang="ts">
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import LibraryHeader from "@/modules/library/components/LibraryHeader.vue";
import LibraryToolbar from "@/modules/library/components/LibraryToolbar.vue";
import LibraryGrid from "@/modules/library/components/LibraryGrid.vue";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import type { LibraryFilter, LibraryItem } from "@/modules/library/types";

const {
  sortBy,
  activeFilter,
  searchQuery,
  pinnedItems,
  unpinnedItems,
  isLoading,
  setFilter,
  setSortBy,
  setSearchQuery,
  createPlaylist,
} = useLibrary();

function handleFilter(filter: LibraryFilter) {
  if (activeFilter.value === filter) {
    setFilter("all");
  }
  else {
    setFilter(filter);
  }
}

function handlePlay(_item: LibraryItem) {
  // TODO: implement play for each entity type
}

function handleContextMenu(_event: MouseEvent, _item: LibraryItem) {
  // TODO: implement context menu with pin/unpin
}
</script>
