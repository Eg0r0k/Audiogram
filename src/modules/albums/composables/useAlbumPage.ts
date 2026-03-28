import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { AlbumId } from "@/types/ids";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import type { AlbumEntity } from "@/db/entities";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import { useObjectUrl } from "@vueuse/core";
import type { AlbumData } from "@/modules/media-hero/types";

export interface AlbumChanges {
  title?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

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
  } = useQuery({
    queryKey: computed(() => queryKeys.albums.detail(albumId.value)),
    queryFn: async () => {
      const res = await albumRepository.findById(albumId.value);
      if (res.isErr()) throw res.error;
      if (!res.value) throw new Error("Album not found");
      return res.value;
    },
  });

  const album = computed<AlbumEntity | null>(() => albumQueryData.value ?? null);

  const {
    data: coverBlob,
    isLoading: isCoverLoading,
  } = useQuery({
    queryKey: computed(() => queryKeys.albums.cover(albumId.value)),
    queryFn: async () => {
      const res = await coverRepository.getAlbumCover(albumId.value);
      if (res.isErr()) throw res.error;
      return res.value?.blob ?? null;
    },
    enabled: computed(() => !!album.value),
  });

  const coverUrl = useObjectUrl(computed(() => coverBlob.value));

  const { data: rawTracks, isLoading: isTracksLoading } = useQuery({
    queryKey: computed(() => queryKeys.albums.tracks(albumId.value)),
    queryFn: async () => {
      const res = await trackRepository.findByAlbumId(albumId.value);
      if (res.isErr()) throw res.error;
      return res.value;
    },
    enabled: computed(() => !!album.value),
  });

  const artistId = computed(() => album.value?.artistId ?? null);

  const { data: artist } = useQuery({
    queryKey: computed(() =>
      artistId.value
        ? queryKeys.artists.detail(artistId.value)
        : ["artists", "detail", "unknown"],
    ),
    queryFn: async () => {
      if (!artistId.value) return null;

      const res = await artistRepository.findById(artistId.value);
      if (res.isErr()) throw res.error;
      return res.value ?? null;
    },
    enabled: computed(() => !!artistId.value),
  });

  const isLoading = computed(() =>
    isAlbumLoading.value || isTracksLoading.value || isCoverLoading.value,
  );

  const tracks = computed(() => {
    if (!rawTracks.value || !artist.value || !album.value) return [];
    return mapTracks(rawTracks.value, [artist.value], [album.value]);
  });

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
    mutationFn: async () => {
      const current = album.value;
      if (!current) return;

      const deleteCoverResult = await coverRepository.deleteAlbumCover(current.id);
      if (deleteCoverResult.isErr()) throw deleteCoverResult.error;

      const deleteTracksResult = await trackRepository.deleteByAlbumId(current.id);
      if (deleteTracksResult.isErr()) throw deleteTracksResult.error;

      const deleteAlbumResult = await albumRepository.delete(current.id);
      if (deleteAlbumResult.isErr()) throw deleteAlbumResult.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.cover(albumId.value) });
      router.push("/library");
    },
  });

  const { mutateAsync: updateAlbum } = useMutation({
    mutationFn: async (changes: AlbumChanges) => {
      const current = album.value;
      if (!current) return;

      const updateData: Partial<AlbumEntity> = {};

      if (changes.title && changes.title !== current.title) {
        updateData.title = changes.title;
      }

      if (changes.coverBlob) {
        const coverResult = await coverRepository.upsertAlbumCover(
          current.id,
          changes.coverBlob,
        );
        if (coverResult.isErr()) throw coverResult.error;
      }
      else if (changes.removeCover) {
        const deleteCoverResult = await coverRepository.deleteAlbumCover(current.id);
        if (deleteCoverResult.isErr()) throw deleteCoverResult.error;
      }

      if (Object.keys(updateData).length > 0) {
        const result = await albumRepository.update(current.id, updateData);
        if (result.isErr()) throw result.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.detail(albumId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.cover(albumId.value) });
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
