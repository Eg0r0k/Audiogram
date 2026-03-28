import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { ArtistId } from "@/types/ids";
import type { ArtistEntity } from "@/db/entities";
import { ArtistData } from "@/modules/media-hero/types";
import {
  artistQueries,
  deleteArtistAndSync,
  updateArtistAndSync,
} from "@/queries/artist.queries";

export function useArtistPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const artistId = computed(() => ArtistId(route.params.id as string));

  const {
    data: artistPageData,
    isLoading: isArtistLoading,
    isError,
    error,
    refetch,
  } = useQuery(computed(() => artistQueries.page(artistId.value)));

  const artist = computed(() => artistPageData.value?.artist ?? null);
  const albums = computed(() => artistPageData.value?.albums ?? []);
  const tracks = computed(() => artistPageData.value?.tracks ?? []);

  const isLoading = computed(
    () => isArtistLoading.value,
  );

  const artistData = computed<ArtistData | null>(() => {
    if (!artist.value) return null;

    return {
      type: "artist",
      id: artist.value.id,
      title: artist.value.name,
      image: "",
      monthlyListeners: 0,
      isFollowing: false,
    };
  });

  const { mutateAsync: deleteArtist } = useMutation({
    mutationFn: () => deleteArtistAndSync(queryClient, artistPageData.value ?? null),
    onSuccess: () => {
      router.push("/library");
    },
  });

  const { mutateAsync: updateArtist } = useMutation({
    mutationFn: async (changes: Partial<ArtistEntity>) => {
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
    artistData,
    isLoading,
    isError,
    error,
    deleteArtist,
    updateArtist,
    refetch,
  };
}
