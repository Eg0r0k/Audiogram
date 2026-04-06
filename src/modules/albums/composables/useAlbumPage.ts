import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/vue-query";
import { AlbumId } from "@/types/ids";
import { useObjectUrl } from "@vueuse/core";
import type { AlbumData } from "@/modules/media-hero/types";
import { queryKeys } from "@/queries/query-keys";
import {
  albumQueries,
  deleteAlbumAndSync,
  getAlbumTracksPaginated,
  type AlbumChanges,
  updateAlbumAndSync,
} from "@/queries/album.queries";
import { coverQueries } from "@/queries/cover.queries";

export type { AlbumChanges } from "@/queries/album.queries";

export function useAlbumPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const albumId = computed(() => AlbumId(route.params.id as string));

  const {
    data: albumData,
    isLoading: isAlbumLoading,
    isError,
    error,
    refetch,
  } = useQuery(computed(() => albumQueries.detail(albumId.value)));

  const album = computed(() => albumData.value ?? null);

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.albums.tracksPage(albumId.value)),
    queryFn: ({ pageParam = 0 }) => getAlbumTracksPaginated(albumId.value, pageParam),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    enabled: computed(() => !!album.value),
  });

  const tracks = computed(() =>
    infiniteData.value?.pages.flatMap(page => page.tracks) ?? [],
  );

  const trackCount = computed(
    () => infiniteData.value?.pages[0]?.total ?? 0,
  );

  const artist = computed(() => (album.value ? { id: album.value.artistId, name: "" } : null));

  const {
    data: coverBlob,
    isLoading: isCoverLoading,
  } = useQuery(computed(() => coverQueries.detail("album", albumId.value)));

  const coverUrl = useObjectUrl(computed(() => coverBlob.value));

  const isLoading = computed(() =>
    isAlbumLoading.value || isCoverLoading.value,
  );

  const albumDataMapped = computed<AlbumData | null>(() => {
    if (!album.value) return null;

    return {
      type: "album",
      id: album.value.id,
      title: album.value.title,
      artistName: artist.value?.name ?? "",
      artistId: album.value.artistId,
      image: coverUrl.value ?? "",
      releaseYear: album.value.year ?? 0,
      trackCount: trackCount.value,
    };
  });

  const { mutateAsync: deleteAlbum } = useMutation({
    mutationFn: () => deleteAlbumAndSync(queryClient, albumData.value ?? null),
    onSuccess: () => {
      router.push("/library");
    },
  });

  const { mutateAsync: updateAlbum } = useMutation({
    mutationFn: async (changes: AlbumChanges) => {
      const current = album.value;
      if (!current) {
        return;
      }

      return updateAlbumAndSync(queryClient, current, changes);
    },
  });

  return {
    album,
    tracks,
    albumData: albumDataMapped,
    coverUrl,
    isLoading,
    isError,
    error,
    deleteAlbum,
    updateAlbum,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  };
}
