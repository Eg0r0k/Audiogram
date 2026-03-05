import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { AlbumId } from "@/types/ids";
import { albumRepository, artistRepository, trackRepository } from "@/db/repositories";
import { storageService } from "@/db/storage";
import type { AlbumEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { AlbumData } from "@/components/media-hero/types";
import { generateCoverFileName } from "@/lib/uniqeName";

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
    queryKey: ["album-page", albumId],
    queryFn: async () => {
      const albumRes = await albumRepository.findById(albumId.value);
      if (albumRes.isErr()) throw albumRes.error;
      const album = albumRes.value;
      if (!album) throw new Error("Album not found");

      const artistRes = await artistRepository.findById(album.artistId);
      const artist = artistRes.isOk() ? artistRes.value : null;

      const tracksRes = await trackRepository.findByAlbumId(albumId.value);
      if (tracksRes.isErr()) throw tracksRes.error;

      // Получаем URL обложки альбома
      let coverUrl: string | undefined;
      if (album.coverPath) {
        const coverUrlResult = await storageService.getAudioUrl(album.coverPath);
        if (coverUrlResult.isOk()) {
          coverUrl = coverUrlResult.value;
        }
      }

      const tracks = await Promise.all(
        tracksRes.value.map(async (entity) => {
          const urlResult = await storageService.getAudioUrl(entity.storagePath);
          if (urlResult.isErr()) return null;

          return {
            id: entity.id,
            title: entity.title,
            artist: artist?.name ?? "Unknown",
            artistId: entity.artistId,
            albumId: entity.albumId,
            albumName: album.title,
            // Обложка трека пока не фетчится, оставляем undefined
            cover: undefined,
            url: urlResult.value,
            duration: entity.duration,
            isLiked: entity.isLiked,
          } as Track;
        }),
      );

      return {
        album,
        artist,
        tracks: tracks.filter((t): t is Track => t !== null),
        coverUrl,
      };
    },
  });

  const album = computed(() => data.value?.album ?? null);
  const tracks = computed(() => data.value?.tracks ?? []);
  const coverUrl = computed(() => data.value?.coverUrl);

  const albumData = computed<AlbumData | null>(() => {
    if (!data.value?.album || !data.value?.artist) return null;
    return {
      type: "album",
      id: data.value.album.id,
      title: data.value.album.title,
      artistName: data.value.artist.name,
      artistId: data.value.artist.id,
      image: data.value.coverUrl ?? "",
      releaseYear: data.value.album.year ?? 0,
      trackCount: data.value.tracks.length,
    };
  });

  const { mutateAsync: deleteAlbum } = useMutation({
    mutationFn: async () => {
      const currentAlbum = album.value;
      if (!currentAlbum) return;

      if (currentAlbum.coverPath) {
        await storageService.deleteFile(currentAlbum.coverPath);
      }

      await trackRepository.deleteByAlbumId(currentAlbum.id);
      await albumRepository.delete(currentAlbum.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      router.push("/library");
    },
  });

  const { mutateAsync: updateAlbum } = useMutation({
    mutationFn: async (changes: AlbumChanges) => {
      const currentAlbum = album.value;
      if (!currentAlbum) return;

      const updateData: Partial<AlbumEntity> = {};

      if (changes.title && changes.title !== currentAlbum.title) {
        updateData.title = changes.title;
      }

      if (changes.coverBlob) {
        if (currentAlbum.coverPath) {
          const deleteResult = await storageService.deleteFile(currentAlbum.coverPath);
          if (deleteResult.isErr()) {
            console.warn("Failed to delete old cover:", deleteResult.error);
          }
        }

        const coverPath = generateCoverFileName(currentAlbum.id, changes.coverBlob.type);
        const saveResult = await storageService.saveFile(coverPath, changes.coverBlob);

        if (saveResult.isErr()) {
          throw new Error(`Failed to save cover: ${saveResult.error.message}`);
        }

        updateData.coverPath = saveResult.value;
      }
      else if (changes.removeCover && currentAlbum.coverPath) {
        const deleteResult = await storageService.deleteFile(currentAlbum.coverPath);
        if (deleteResult.isErr()) {
          console.warn("Failed to delete cover:", deleteResult.error);
        }
        updateData.coverPath = undefined;
      }

      if (Object.keys(updateData).length > 0) {
        const updateResult = await albumRepository.update(currentAlbum.id, updateData);
        if (updateResult.isErr()) {
          throw new Error(`Failed to update album: ${updateResult.error.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album-page", albumId] });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
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
