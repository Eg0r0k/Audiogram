import { useRouter } from "vue-router";
import { useLibraryStore } from "../store/library.store";
import { storeToRefs } from "pinia";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";
import { artistRepository } from "@/db/repositories/artist.repository";
import { albumRepository } from "@/db/repositories/album.repository";
import { playlistRepository } from "@/db/repositories/playlist.repository";
import { LibraryItem } from "../types";
import { PlaylistId } from "@/types/ids";
import { queryKeys } from "@/lib/query-keys";

export const useLibrary = () => {
  const store = useLibraryStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { sortBy, activeFilter, searchQuery } = storeToRefs(store);

  const { data: artists, isLoading: isLoadingArtists } = useQuery({
    queryKey: queryKeys.artists.all(),
    queryFn: async () => {
      const result = await artistRepository.findAll();
      if (result.isErr()) throw result.error;
      return result.value;
    },
  });

  const { data: albums, isLoading: isLoadingAlbums } = useQuery({
    queryKey: queryKeys.albums.all(),
    queryFn: async () => {
      const result = await albumRepository.findAll();
      if (result.isErr()) throw result.error;
      return result.value;
    },
  });

  const { data: playlists, isLoading: isLoadingPlaylists } = useQuery({
    queryKey: queryKeys.playlists.all(),
    queryFn: async () => {
      const result = await playlistRepository.findAll();
      if (result.isErr()) throw result.error;
      return result.value;
    },
  });

  const isLoading = computed(
    () => isLoadingArtists.value || isLoadingAlbums.value || isLoadingPlaylists.value,
  );

  const artistMap = computed(() => {
    const map = new Map<string, string>();
    for (const a of artists.value ?? []) {
      map.set(a.id, a.name);
    }
    return map;
  });

  const allItems = computed<LibraryItem[]>(() => {
    const items: LibraryItem[] = [];

    for (const artist of artists.value ?? []) {
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

    for (const album of albums.value ?? []) {
      const artistName = artistMap.value.get(album.artistId);
      items.push({
        id: album.id,
        type: "album",
        title: album.title,
        subtitle: artistName,
        coverPath: album.coverPath,
        isPinned: store.isPinned("album", album.id),
        addedAt: album.addedAt,
        updatedAt: album.updatedAt,
        artistName,
        to: { name: "album", params: { id: album.id } },
        rounded: false,
      });
    }

    for (const playlist of playlists.value ?? []) {
      items.push({
        id: playlist.id,
        type: "playlist",
        title: playlist.name,
        subtitle: `${playlist.trackIds.length} tracks`,
        coverPath: playlist.coverPath,
        isPinned: store.isPinned("playlist", playlist.id),
        addedAt: playlist.addedAt,
        updatedAt: playlist.updatedAt,
        to: { name: "playlist", params: { id: playlist.id } },
        rounded: false,
      });
    }

    return items;
  });

  const filteredItems = computed(() => {
    let items = allItems.value;

    if (activeFilter.value !== "all") {
      items = items.filter(i => i.type === activeFilter.value);
    }

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
      items = items.filter(i =>
        i.title.toLowerCase().includes(q)
        || i.subtitle?.toLowerCase().includes(q)
        || i.artistName?.toLowerCase().includes(q),
      );
    }

    return items;
  });

  const sortedItems = computed(() => {
    const items = [...filteredItems.value];

    const pinnedOrder = new Map<string, number>();
    for (const p of store.pinnedItems) {
      pinnedOrder.set(`${p.type}:${p.id}`, p.pinnedAt);
    }

    items.sort((a, b) => {
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      if (a.isPinned && b.isPinned) {
        const aOrder = pinnedOrder.get(`${a.type}:${a.id}`) ?? 0;
        const bOrder = pinnedOrder.get(`${b.type}:${b.id}`) ?? 0;
        return aOrder - bOrder;
      }

      switch (sortBy.value) {
        case "recent": return b.addedAt - a.addedAt;
        case "updated": return (b.updatedAt ?? b.addedAt) - (a.updatedAt ?? a.addedAt);
        case "alphabetical": return a.title.localeCompare(b.title);
        case "author": return (a.artistName ?? a.title).localeCompare(b.artistName ?? b.title);
        default: return 0;
      }
    });

    return items;
  });

  const pinnedItems = computed(() => sortedItems.value.filter(i => i.isPinned));
  const unpinnedItems = computed(() => sortedItems.value.filter(i => !i.isPinned));
  const isEmpty = computed(() => allItems.value.length === 0 && !isLoading.value);
  const hasResults = computed(() => sortedItems.value.length > 0);

  const createPlaylist = async () => {
    const id = PlaylistId(crypto.randomUUID());
    const now = Date.now();

    const result = await playlistRepository.create({
      id,
      name: "New playlist",
      trackIds: [],
      addedAt: now,
      updatedAt: now,
    });

    if (result.isOk()) {
      await queryClient.invalidateQueries({ queryKey: ["library", "playlists"] });
      router.push({ name: "playlist", params: { id } });
    }
  };

  const invalidateLibrary = async () => {
    await queryClient.invalidateQueries({ queryKey: ["library"] });
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
