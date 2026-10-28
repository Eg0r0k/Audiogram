import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { LibraryFilter, LibrarySortKey, PinnedItem } from "../types";

export const useLibraryStore = defineStore("library", () => {
  const pinnedItems = ref<PinnedItem[]>([]);
  const sortKey = ref<LibrarySortKey | null>(null);
  const activeFilter = ref<LibraryFilter>("all");
  const searchQuery = ref("");

  const pinnedSet = computed(() => {
    const set = new Set<string>();
    for (const item of pinnedItems.value) {
      set.add(`${item.type}:${item.id}`);
    }
    return set;
  });

  const isPinned = (type: PinnedItem["type"], id: string) => {
    return pinnedSet.value.has(`${type}:${id}`);
  };

  const pin = (type: PinnedItem["type"], id: string) => {
    if (isPinned(type, id)) return;
    pinnedItems.value.push({ type, id, pinnedAt: Date.now() });
  };

  const unpin = (type: PinnedItem["type"], id: string) => {
    pinnedItems.value = pinnedItems.value.filter(
      p => !(p.type === type && p.id === id),
    );
  };

  const togglePin = (type: PinnedItem["type"], id: string) => {
    if (isPinned(type, id)) {
      unpin(type, id);
    }
    else {
      pin(type, id);
    }
  };

  const setFilter = (filter: LibraryFilter) => {
    activeFilter.value = filter;
  };

  const setSortKey = (key: LibrarySortKey | null) => {
    sortKey.value = key;
  };

  const setSearchQuery = (query: string) => {
    searchQuery.value = query;
  };

  const clearSearch = () => {
    searchQuery.value = "";
  };

  const clearPins = () => {
    pinnedItems.value = [];
  };

  return {
    pinnedItems,
    sortKey,
    activeFilter,
    searchQuery,
    pinnedSet,
    isPinned,
    pin,
    unpin,
    togglePin,
    setFilter,
    setSortKey,
    setSearchQuery,
    clearSearch,
    clearPins,
  };
}, {
  persist: {
    key: "auriogram-library",
    pick: ["pinnedItems", "sortKey", "activeFilter"],
  },
});
