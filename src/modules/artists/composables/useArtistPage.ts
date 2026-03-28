import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { ArtistId } from "@/types/ids";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import type { ArtistEntity } from "@/db/entities";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import { ArtistData } from "@/modules/media-hero/types";

export function useArtistPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const artistId = computed(() => ArtistId(route.params.id as string));

  const {
    data: artist,
    isLoading: isArtistLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: computed(() => queryKeys.artists.detail(artistId.value)),
    queryFn: async () => {
      const res = await artistRepository.findById(artistId.value);
      if (res.isErr()) throw res.error;
      if (!res.value) throw new Error("Artist not found");
      return res.value;
    },
  });

  const { data: albums, isLoading: isAlbumsLoading } = useQuery({
    queryKey: computed(() => queryKeys.artists.albums(artistId.value)),
    queryFn: async () => {
      const res = await albumRepository.findByArtistId(artistId.value);
      if (res.isErr()) throw res.error;
      return res.value;
    },
    enabled: computed(() => !!artist.value),
  });

  const { data: rawTracks, isLoading: isTracksLoading } = useQuery({
    queryKey: computed(() => queryKeys.artists.tracks(artistId.value)),
    queryFn: async () => {
      const res = await trackRepository.findByArtistId(artistId.value);
      if (res.isErr()) throw res.error;
      return res.value;
    },
    enabled: computed(() => !!artist.value),
  });

  const isLoading = computed(
    () => isArtistLoading.value || isAlbumsLoading.value || isTracksLoading.value,
  );

  const tracks = computed(() => {
    if (!rawTracks.value || !artist.value || !albums.value) return [];
    return mapTracks(rawTracks.value, [artist.value], albums.value);
  });

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
    mutationFn: async () => {
      const albumEntities = albums.value ?? [];

      for (const album of albumEntities) {
        const deleteCoverResult = await coverRepository.deleteAlbumCover(album.id);
        if (deleteCoverResult.isErr()) throw deleteCoverResult.error;

        const deleteAlbumResult = await albumRepository.delete(album.id);
        if (deleteAlbumResult.isErr()) throw deleteAlbumResult.error;
      }

      const deleteTracksResult = await trackRepository.deleteByArtistId(artistId.value);
      if (deleteTracksResult.isErr()) throw deleteTracksResult.error;

      const deleteArtistResult = await artistRepository.delete(artistId.value);
      if (deleteArtistResult.isErr()) throw deleteArtistResult.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() });
      router.push("/library");
    },
  });

  const { mutateAsync: updateArtist } = useMutation({
    mutationFn: async (changes: Partial<ArtistEntity>) => {
      const result = await artistRepository.update(artistId.value, changes);
      if (result.isErr()) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.detail(artistId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() });
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
