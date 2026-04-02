<template>
  <Scrollable
    ref="scrollableRef"
    class="flex-1  bg-background!"
    @scroll="onScroll"
  >
    <div
      class="sticky top-0 z-10 transition-shadow duration-200"
      :class="isScrolled ? 'shadow-xl' : ''"
    >
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
    </div>

    <LibraryGrid
      :pinned="pinnedItems"
      :unpinned="unpinnedItems"
      :is-loading="isLoading"
    />
  </Scrollable>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import LibraryHeader from "@/modules/library/components/LibraryHeader.vue";
import LibraryToolbar from "@/modules/library/components/LibraryToolbar.vue";
import LibraryGrid from "@/modules/library/components/LibraryGrid.vue";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import type { LibraryFilter, LibraryItem } from "@/modules/library/types";
import { useScrollRestoration } from "@/components/ui/scrollable/useScrollRestoration";
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

const isScrolled = ref(false);

function onScroll(event: Event) {
  const target = event.target as HTMLElement;
  isScrolled.value = target.scrollTop > 0;
}

function handleFilter(filter: LibraryFilter) {
  if (activeFilter.value === filter) {
    setFilter("all");
  }
  else {
    setFilter(filter);
  }
}

const scrollableRef = ref<InstanceType<typeof Scrollable> | null>(null);
useScrollRestoration(scrollableRef);

</script>
