import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/vue-query";
import { ArtistId } from "@/types/ids";
import { ArtistData } from "@/modules/media-hero/types";
import { queryKeys } from "@/queries/query-keys";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import {
  artistQueries,
  deleteArtistAndSync,
  getArtistAlbumsPaginated,
  getArtistTracksPaginated,
  type ArtistChanges,
  updateArtistAndSync,
} from "@/queries/artist.queries";
import { routeLocation } from "@/app/router/route-locations";

export type { ArtistChanges } from "@/queries/artist.queries";

export function useArtistPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const artistId = computed(() => ArtistId(route.params.id as string));

  const {
    data: artistData,
    isLoading: isArtistLoading,
    isError,
    error,
    refetch,
  } = useQuery(computed(() => artistQueries.detail(artistId.value)));

  const artist = computed(() => artistData.value ?? null);

  const {
    data: tracksInfiniteData,
    fetchNextPage: fetchNextTrackPage,
    hasNextPage: hasNextTrackPage,
    isFetchingNextPage: isFetchingNextTrackPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.artists.tracksPage(artistId.value)),
    queryFn: ({ pageParam = 0 }) => getArtistTracksPaginated(artistId.value, pageParam),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    enabled: computed(() => !!artist.value),
  });

  const tracks = computed(() =>
    tracksInfiniteData.value?.pages.flatMap(page => page.tracks) ?? [],
  );

  const {
    data: albumsInfiniteData,
    fetchNextPage: fetchNextAlbumPage,
    hasNextPage: hasNextAlbumPage,
    isFetchingNextPage: isFetchingNextAlbumPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.artists.albums(artistId.value)),
    queryFn: ({ pageParam = 0 }) => getArtistAlbumsPaginated(artistId.value, pageParam),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    enabled: computed(() => !!artist.value),
  });

  const albums = computed(() =>
    albumsInfiniteData.value?.pages.flatMap(page => page.albums) ?? [],
  );

  const trackCount = computed(
    () => tracksInfiniteData.value?.pages[0]?.total ?? 0,
  );

  const albumCount = computed(
    () => albumsInfiniteData.value?.pages[0]?.total ?? 0,
  );

  const {
    url: coverUrl,
    isLoading: isCoverLoading,
  } = useEntityCover("artist", artistId);

  const isLoading = computed(
    () => isArtistLoading.value || isCoverLoading.value,
  );

  const artistDataMapped = computed<ArtistData | null>(() => {
    if (!artist.value) return null;

    return {
      type: "artist",
      id: artist.value.id,
      title: artist.value.name,
      image: coverUrl.value ?? "",
      monthlyListeners: 0,
      isFollowing: false,
      bio: artist.value.bio,
    };
  });

  const { mutateAsync: deleteArtist } = useMutation({
    mutationFn: () => deleteArtistAndSync(queryClient, artistData.value ?? null),
    onSuccess: () => {
      router.push(routeLocation.home());
    },
  });

  const { mutateAsync: updateArtist } = useMutation({
    mutationFn: async (changes: ArtistChanges) => {
      const current = artist.value;
      if (!current) {
        return;
      }

      return updateArtistAndSync(queryClient, current, changes);
    },
  });

  return {
    artist,
    albums,
    tracks,
    artistData: artistDataMapped,
    coverUrl,
    trackCount,
    albumCount,
    isLoading,
    isError,
    error,
    deleteArtist,
    updateArtist,
    refetch,
    fetchNextTrackPage,
    hasNextTrackPage,
    isFetchingNextTrackPage,
    fetchNextAlbumPage,
    hasNextAlbumPage,
    isFetchingNextAlbumPage,
  };
}
