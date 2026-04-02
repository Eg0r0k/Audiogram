import { useRouter } from "vue-router";
import { useLibraryStore } from "../store/library.store";
import { storeToRefs } from "pinia";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { LibraryItem } from "../types";
import { createPlaylistAndSync } from "@/queries/playlist.queries";
import { invalidateLibrarySummary, libraryQueries } from "@/queries/library.queries";

export const useLibrary = () => {
  const store = useLibraryStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { sortBy, activeFilter, searchQuery } = storeToRefs(store);

  const { data, isLoading } = useQuery(libraryQueries.summary());
  const artists = computed(() => data.value?.artists ?? []);
  const albums = computed(() => data.value?.albums ?? []);
  const playlists = computed(() => data.value?.playlists ?? []);
  const likedTracks = computed(() => data.value?.likedTracks ?? []);

  const artistMap = computed(() => {
    const map = new Map<string, string>();

    for (const artist of artists.value) {
      map.set(artist.id, artist.name);
    }

    return map;
  });

  const likedItem = computed<LibraryItem>(() => ({
    id: "liked",
    type: "liked",
    title: t("common.favorite"),
    subtitle: t("common.trackCount", { count: likedTracks.value?.length ?? 0 }),
    image: "/img/liked-fallback.svg",
    isPinned: true,
    isSystem: true,
    addedAt: 0,
    updatedAt: 0,
    to: { name: "liked" },
    rounded: false,
  }));

  const allItems = computed<LibraryItem[]>(() => {
    const items: LibraryItem[] = [likedItem.value];

    for (const artist of artists.value) {
      items.push({
        id: artist.id,
        type: "artist",
        title: artist.name,
        isPinned: store.isPinned("artist", artist.id),
        addedAt: artist.addedAt,
        updatedAt: artist.updatedAt,
        artistName: artist.name,
        to: { name: "artist", params: { id: artist.id } },
        rounded: true,
      });
    }

    for (const album of albums.value) {
      const artistName = artistMap.value.get(album.artistId);

      items.push({
        id: album.id,
        type: "album",
        title: album.title,
        subtitle: artistName,
        isPinned: store.isPinned("album", album.id),
        addedAt: album.addedAt,
        updatedAt: album.updatedAt,
        artistName,
        to: { name: "album", params: { id: album.id } },
        rounded: false,
      });
    }

    for (const playlist of playlists.value) {
      items.push({
        id: playlist.id,
        type: "playlist",
        title: playlist.name,
        subtitle: t("common.trackCount", playlist.trackIds.length),
        isPinned: store.isPinned("playlist", playlist.id),
        addedAt: playlist.addedAt,
        updatedAt: playlist.updatedAt,
        to: { name: "playlist", params: { id: playlist.id } },
        rounded: false,
      });
    }

    return items;
  });

  const shouldShowSystemItems = computed(() =>
    activeFilter.value === "all" || activeFilter.value === "album",
  );

  const filteredItems = computed(() => {
    const systemItems = shouldShowSystemItems.value
      ? allItems.value.filter(item => item.isSystem)
      : [];

    let items = allItems.value.filter(item => !item.isSystem);

    if (activeFilter.value !== "all") {
      items = items.filter(item => item.type === activeFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
      items = items.filter(item =>
        item.title.toLowerCase().includes(q)
        || item.subtitle?.toLowerCase().includes(q)
        || item.artistName?.toLowerCase().includes(q),
      );
    }

    return [...systemItems, ...items];
  });

  const sortedItems = computed(() => {
    const items = [...filteredItems.value];

    const pinnedOrder = new Map<string, number>();
    for (const pinned of store.pinnedItems) {
      pinnedOrder.set(`${pinned.type}:${pinned.id}`, pinned.pinnedAt);
    }

    items.sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;

      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (a.isPinned && b.isPinned && !a.isSystem && !b.isSystem) {
        const aOrder = pinnedOrder.get(`${a.type}:${a.id}`) ?? 0;
        const bOrder = pinnedOrder.get(`${b.type}:${b.id}`) ?? 0;
        return aOrder - bOrder;
      }

      switch (sortBy.value) {
        case "recent":
          return b.addedAt - a.addedAt;
        case "updated":
          return (b.updatedAt ?? b.addedAt) - (a.updatedAt ?? a.addedAt);
        case "alphabetical":
          return a.title.localeCompare(b.title);
        case "author":
          return (a.artistName ?? a.title).localeCompare(b.artistName ?? b.title);
        default:
          return 0;
      }
    });

    return items;
  });

  const pinnedItems = computed(() => sortedItems.value.filter(item => item.isPinned));
  const unpinnedItems = computed(() => sortedItems.value.filter(item => !item.isPinned));
  const isEmpty = computed(() => allItems.value.length === 0 && !isLoading.value);
  const hasResults = computed(() => sortedItems.value.length > 0);

  const createPlaylist = async () => {
    const playlist = await createPlaylistAndSync(queryClient);
    router.push({ name: "playlist", params: { id: playlist.id } });
  };

  const invalidateLibrary = async () => {
    await invalidateLibrarySummary(queryClient);
  };

  return {
    sortBy,
    activeFilter,
    searchQuery,
    allItems,
    pinnedItems,
    unpinnedItems,
    isLoading,
    isEmpty,
    hasResults,
    setFilter: store.setFilter,
    setSortBy: store.setSortBy,
    setSearchQuery: store.setSearchQuery,
    clearSearch: store.clearSearch,
    togglePin: store.togglePin,
    isPinned: store.isPinned,
    createPlaylist,
    invalidateLibrary,
  };
};
