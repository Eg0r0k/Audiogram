import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { PlaylistId } from "@/types/ids";
import { playlistRepository } from "@/db/repositories/playlist.repository";
import { trackRepository } from "@/db/repositories/track.repository";
import { artistRepository } from "@/db/repositories/artist.repository";
import { albumRepository } from "@/db/repositories/album.repository";
import { storageService } from "@/db/storage";
import { generateCoverFileName } from "@/lib/uniqeName";
import type { PlaylistEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";
import type { PlaylistData } from "@/components/media-hero/types";
import { invalidateCoverCache, resolveTrackUrl } from "@/lib/storage";

export interface PlaylistChanges {
  name?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

export function usePlaylistPage() {
  const route = useRoute();
  const router = useRouter();
  const queryClient = useQueryClient();

  const playlistId = computed(() => PlaylistId(route.params.id as string));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["playlist-page", playlistId],
    queryFn: async () => {
      const playlistRes = await playlistRepository.findById(playlistId.value);
      if (playlistRes.isErr()) throw playlistRes.error;
      const playlist = playlistRes.value;
      if (!playlist) throw new Error("Playlist not found");

      let coverUrl: string | undefined;
      if (playlist.coverPath) {
        const coverUrlResult = await storageService.getAudioUrl(playlist.coverPath);
        if (coverUrlResult.isOk()) {
          coverUrl = coverUrlResult.value;
        }
      }

      const tracks: Track[] = [];

      for (const trackId of playlist.trackIds) {
        const trackRes = await trackRepository.findById(trackId);
        if (trackRes.isErr() || !trackRes.value) continue;

        const entity = trackRes.value;

        const url = await resolveTrackUrl(entity.source, entity.storagePath);
        if (!url) continue;

        const artistRes = await artistRepository.findById(entity.artistId);
        const artistName = artistRes.isOk() ? artistRes.value?.name ?? "Unknown" : "Unknown";

        const albumRes = await albumRepository.findById(entity.albumId);
        const albumName = albumRes.isOk() ? albumRes.value?.title ?? "Unknown" : "Unknown";

        tracks.push({
          id: entity.id,
          title: entity.title,
          artist: artistName,
          artistId: entity.artistId,
          albumId: entity.albumId,
          albumName,
          cover: undefined,
          url: url,
          duration: entity.duration,
          isLiked: entity.isLiked,
        });
      }

      return {
        playlist,
        tracks,
        coverUrl,
      };
    },
  });

  const playlist = computed(() => data.value?.playlist ?? null);
  const tracks = computed(() => data.value?.tracks ?? []);
  const coverUrl = computed(() => data.value?.coverUrl);

  const totalDuration = computed(() => {
    const seconds = tracks.value.reduce((sum, t) => sum + t.duration, 0);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} hr ${remainingMinutes} min`;
  });

  const playlistData = computed<PlaylistData | null>(() => {
    if (!data.value?.playlist) return null;
    return {
      type: "playlist",
      id: data.value.playlist.id,
      title: data.value.playlist.name,
      image: data.value.coverUrl ?? "",
      isOwner: true,
      trackCount: data.value.tracks.length,
      duration: totalDuration.value,
      description: data.value.playlist.description,
    };
  });

  const { mutateAsync: deletePlaylist } = useMutation({
    mutationFn: async () => {
      const current = playlist.value;
      if (!current) return;

      if (current.coverPath) {
        await storageService.deleteFile(current.coverPath);
      }

      await playlistRepository.delete(current.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      router.push("/library");
    },
  });

  const { mutateAsync: updatePlaylist } = useMutation({
    mutationFn: async (changes: PlaylistChanges) => {
      const current = playlist.value;
      if (!current) return;

      const updateData: Partial<PlaylistEntity> = {};

      if (changes.name && changes.name !== current.name) {
        updateData.name = changes.name;
      }

      if (changes.description !== undefined) {
        updateData.description = changes.description;
      }

      if (changes.coverBlob) {
        if (current.coverPath) {
          await storageService.deleteFile(current.coverPath);
          invalidateCoverCache(current.coverPath);
        }

        const coverPath = generateCoverFileName(current.id, changes.coverBlob.type);
        const saveResult = await storageService.saveFile(coverPath, changes.coverBlob);

        if (saveResult.isErr()) {
          throw new Error(`Failed to save cover: ${saveResult.error.message}`);
        }

        updateData.coverPath = saveResult.value;
      }
      else if (changes.removeCover && current.coverPath) {
        invalidateCoverCache(current.coverPath);
        await storageService.deleteFile(current.coverPath);
        updateData.coverPath = undefined;
      }

      if (Object.keys(updateData).length > 0) {
        const updateResult = await playlistRepository.update(current.id, updateData);
        if (updateResult.isErr()) {
          throw new Error(`Failed to update playlist: ${updateResult.error.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-page", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const { mutateAsync: removeTrack } = useMutation({
    mutationFn: async (trackId: string) => {
      const result = await playlistRepository.removeTrack(
        playlistId.value,
        trackId as Parameters<typeof playlistRepository.removeTrack>[1],
      );
      if (result.isErr()) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlist-page", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  return {
    playlist,
    tracks,
    playlistData,
    coverUrl,
    totalDuration,
    isLoading,
    isError,
    error,
    deletePlaylist,
    updatePlaylist,
    removeTrack,
    refetch,
  };
}
