import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { AlbumId } from "@/types/ids";
import { useObjectUrl } from "@vueuse/core";
import type { AlbumData } from "@/modules/media-hero/types";
import {
  albumQueries,
  deleteAlbumAndSync,
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
    data: albumQueryData,
    isLoading: isAlbumLoading,
    isError,
    error,
    refetch,
  } = useQuery(computed(() => albumQueries.page(albumId.value)));

  const album = computed(() => albumQueryData.value?.album ?? null);
  const artist = computed(() => albumQueryData.value?.artist ?? null);
  const tracks = computed(() => albumQueryData.value?.tracks ?? []);

  const {
    data: coverBlob,
    isLoading: isCoverLoading,
  } = useQuery(computed(() => coverQueries.detail("album", albumId.value)));

  const coverUrl = useObjectUrl(computed(() => coverBlob.value));

  const isLoading = computed(() =>
    isAlbumLoading.value || isCoverLoading.value,
  );

  const albumData = computed<AlbumData | null>(() => {
    if (!album.value || !artist.value) return null;

    return {
      type: "album",
      id: album.value.id,
      title: album.value.title,
      artistName: artist.value.name,
      artistId: artist.value.id,
      image: coverUrl.value ?? "",
      releaseYear: album.value.year ?? 0,
      trackCount: tracks.value.length,
    };
  });

  const { mutateAsync: deleteAlbum } = useMutation({
    mutationFn: () => deleteAlbumAndSync(queryClient, albumQueryData.value ?? null),
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
    albumData,
    coverUrl,
    isLoading,
    isError,
    error,
    deleteAlbum,
    updateAlbum,
    refetch,
  };
}
