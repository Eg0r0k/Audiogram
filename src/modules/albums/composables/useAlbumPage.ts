import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { AlbumId } from "@/types/ids";
import { albumRepository, artistRepository, trackRepository } from "@/db/repositories";
import { storageService } from "@/db/storage";
import type { AlbumEntity } from "@/db/entities";
import type { AlbumData } from "@/components/media-hero/types";
import { generateCoverFileName } from "@/lib/uniqeName";
import { getCoverUrl, invalidateCover } from "@/lib/storage";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";

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
    data: albumDetail,
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
      const coverUrl = await getCoverUrl(res.value.coverPath);
      return { album: res.value, coverUrl };
    },
  });

  const { data: rawTracks, isLoading: isTracksLoading } = useQuery({
    queryKey: computed(() => queryKeys.albums.tracks(albumId.value)),
    queryFn: async () => {
      const res = await trackRepository.findByAlbumId(albumId.value);
      if (res.isErr()) throw res.error;
      return res.value;
    },
    enabled: computed(() => !!albumDetail.value),
  });

  const artistId = computed(() => albumDetail.value?.album.artistId);

  const { data: artist } = useQuery({
    queryKey: computed(() => queryKeys.artists.detail(artistId.value!)),
    queryFn: async () => {
      const res = await artistRepository.findById(artistId.value!);
      if (res.isErr()) throw res.error;
      return res.value ?? null;
    },
    enabled: computed(() => !!artistId.value),
  });

  const album = computed(() => albumDetail.value?.album ?? null);
  const coverUrl = computed(() => albumDetail.value?.coverUrl);
  const isLoading = computed(() => isAlbumLoading.value || isTracksLoading.value);

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
      if (current.coverPath) {
        invalidateCover(current.coverPath);
        await storageService.deleteFile(current.coverPath);
      }
      await trackRepository.deleteByAlbumId(current.id);
      await albumRepository.delete(current.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() });
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
        if (current.coverPath) {
          invalidateCover(current.coverPath);
          await storageService.deleteFile(current.coverPath);
        }
        const coverPath = generateCoverFileName(current.id, changes.coverBlob.type);
        const saveResult = await storageService.saveFile(coverPath, changes.coverBlob);
        if (saveResult.isErr()) throw new Error(`Failed to save cover: ${saveResult.error.message}`);
        updateData.coverPath = saveResult.value;
      }
      else if (changes.removeCover && current.coverPath) {
        invalidateCover(current.coverPath);
        await storageService.deleteFile(current.coverPath);
        updateData.coverPath = undefined;
      }

      if (Object.keys(updateData).length > 0) {
        const result = await albumRepository.update(current.id, updateData);
        if (result.isErr()) throw new Error(`Failed to update album: ${result.error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.detail(albumId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() });
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
