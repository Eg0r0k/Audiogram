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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: computed(() => queryKeys.albums.detail(albumId.value)),
    queryFn: async () => {
      const albumRes = await albumRepository.findById(albumId.value);
      if (albumRes.isErr()) throw albumRes.error;
      const album = albumRes.value;
      if (!album) throw new Error("Album not found");

      const [artistRes, tracksRes] = await Promise.all([
        artistRepository.findById(album.artistId),
        trackRepository.findByAlbumId(albumId.value),
      ]);

      const artist = artistRes.isOk() ? artistRes.value : null;
      if (tracksRes.isErr()) throw tracksRes.error;

      const coverUrl = await getCoverUrl(album.coverPath);
      const tracks = mapTracks(tracksRes.value, artist ? [artist] : [], [album]);

      return { album, artist, tracks, coverUrl };
    },
    staleTime: Infinity,
  });

  const album = computed(() => data.value?.album ?? null);
  const tracks = computed(() => data.value?.tracks ?? []);
  const coverUrl = computed(() => data.value?.coverUrl);

  const albumData = computed<AlbumData | null>(() => {
    const d = data.value;
    if (!d?.album || !d?.artist) return null;
    return {
      type: "album",
      id: d.album.id,
      title: d.album.title,
      artistName: d.artist.name,
      artistId: d.artist.id,
      image: d.coverUrl ?? "",
      releaseYear: d.album.year ?? 0,
      trackCount: d.tracks.length,
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
