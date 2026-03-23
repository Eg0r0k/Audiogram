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
import type { PlaylistData } from "@/components/media-hero/types";
import { getCoverUrl, invalidateCover } from "@/lib/storage";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import { formatTotalDuration } from "@/lib/format/time";
import { useI18n } from "vue-i18n";

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

  const { t } = useI18n();

  const playlistId = computed(() => PlaylistId(route.params.id as string));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: computed(() => queryKeys.playlists.detail(playlistId.value)),
    queryFn: async () => {
      const playlistRes = await playlistRepository.findById(playlistId.value);
      if (playlistRes.isErr()) throw playlistRes.error;
      const playlist = playlistRes.value;
      if (!playlist) throw new Error("Playlist not found");

      const coverUrl = await getCoverUrl(playlist.coverPath);

      if (playlist.trackIds.length === 0) {
        return { playlist, tracks: [], coverUrl };
      }

      const tracksRes = await trackRepository.findByIds(playlist.trackIds);
      if (tracksRes.isErr()) throw tracksRes.error;
      const rawTracks = tracksRes.value;

      // Collect only the IDs that actually appear in this playlist — no findAll()
      const artistIds = [...new Set(rawTracks.map(t => t.artistId))];
      const albumIds = [...new Set(rawTracks.map(t => t.albumId))];

      const [artistsRes, albumsRes] = await Promise.all([
        artistRepository.findByIds(artistIds),
        albumRepository.findByIds(albumIds),
      ]);

      // Preserve the playlist track order defined by playlist.trackIds
      const trackMap = new Map(rawTracks.map(t => [t.id, t]));
      const orderedEntities = playlist.trackIds.flatMap((id) => {
        const t = trackMap.get(id);
        return t ? [t] : [];
      });

      const tracks = mapTracks(
        orderedEntities,
        artistsRes.isOk() ? artistsRes.value : [],
        albumsRes.isOk() ? albumsRes.value : [],
      );

      return { playlist, tracks, coverUrl };
    },
  });

  const playlist = computed(() => data.value?.playlist ?? null);
  const tracks = computed(() => data.value?.tracks ?? []);
  const coverUrl = computed(() => data.value?.coverUrl);

  const totalDuration = computed(() => {
    const seconds = tracks.value.reduce((sum, t) => sum + t.duration, 0);
    return formatTotalDuration(seconds, t);
  });

  const playlistData = computed<PlaylistData | null>(() => {
    const d = data.value;
    if (!d?.playlist) return null;
    return {
      type: "playlist",
      id: d.playlist.id,
      title: d.playlist.name,
      image: d.coverUrl ?? "",
      isOwner: true,
      trackCount: d.tracks.length,
      duration: totalDuration.value,
      description: d.playlist.description,
    };
  });

  const { mutateAsync: deletePlaylist } = useMutation({
    mutationFn: async () => {
      const current = playlist.value;
      if (!current) return;
      if (current.coverPath) {
        invalidateCover(current.coverPath);
        await storageService.deleteFile(current.coverPath);
      }
      await playlistRepository.delete(current.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
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
        const result = await playlistRepository.update(current.id, updateData);
        if (result.isErr()) throw new Error(`Failed to update playlist: ${result.error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(playlistId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(playlistId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
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
