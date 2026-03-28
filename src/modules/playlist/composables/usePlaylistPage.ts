import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { PlaylistId } from "@/types/ids";
import { playlistRepository } from "@/db/repositories/playlist.repository";
import { trackRepository } from "@/db/repositories/track.repository";
import { artistRepository } from "@/db/repositories/artist.repository";
import { albumRepository } from "@/db/repositories/album.repository";
import { coverRepository } from "@/db/repositories/cover.repository";
import type { PlaylistEntity } from "@/db/entities";
import type { PlaylistData } from "@/components/media-hero/types";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import { formatTotalDuration } from "@/lib/format/time";
import { useI18n } from "vue-i18n";
import { usePlaylistCover } from "@/modules/covers/composables/usePlaylistCover";

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

  const {
    data: data,
    isLoading: isPlaylistLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: computed(() => queryKeys.playlists.detail(playlistId.value)),
    queryFn: async () => {
      const playlistRes = await playlistRepository.findById(playlistId.value);
      if (playlistRes.isErr()) throw playlistRes.error;

      const playlist = playlistRes.value;
      if (!playlist) throw new Error("Playlist not found");

      if (playlist.trackIds.length === 0) {
        return { playlist, tracks: [] };
      }

      const tracksRes = await trackRepository.findByIds(playlist.trackIds);
      if (tracksRes.isErr()) throw tracksRes.error;
      const rawTracks = tracksRes.value;

      const artistIds = [...new Set(rawTracks.map(t => t.artistId))];
      const albumIds = [...new Set(rawTracks.map(t => t.albumId))];

      const [artistsRes, albumsRes] = await Promise.all([
        artistRepository.findByIds(artistIds),
        albumRepository.findByIds(albumIds),
      ]);

      const trackMap = new Map(rawTracks.map(t => [t.id, t]));
      const orderedEntities = playlist.trackIds.flatMap((id) => {
        const track = trackMap.get(id);
        return track ? [track] : [];
      });

      const tracks = mapTracks(
        orderedEntities,
        artistsRes.isOk() ? artistsRes.value : [],
        albumsRes.isOk() ? albumsRes.value : [],
      );

      return { playlist, tracks };
    },
  });

  const playlist = computed(() => data.value?.playlist ?? null);
  const tracks = computed(() => data.value?.tracks ?? []);

  const {
    url: coverUrl,
    isLoading: isCoverLoading,
  } = usePlaylistCover(playlistId);

  const isLoading = computed(() =>
    isPlaylistLoading.value || isCoverLoading.value,
  );

  const totalDuration = computed(() => {
    const seconds = tracks.value.reduce((sum, t) => sum + t.duration, 0);
    return formatTotalDuration(seconds, t);
  });

  const playlistData = computed<PlaylistData | null>(() => {
    const current = playlist.value;
    if (!current) return null;

    return {
      type: "playlist",
      id: current.id,
      title: current.name,
      image: coverUrl.value ?? "",
      isOwner: true,
      trackCount: tracks.value.length,
      duration: totalDuration.value,
      description: current.description,
    };
  });

  const { mutateAsync: deletePlaylist } = useMutation({
    mutationFn: async () => {
      const current = playlist.value;
      if (!current) return;

      const deleteCoverResult = await coverRepository.deletePlaylistCover(current.id);
      if (deleteCoverResult.isErr()) throw deleteCoverResult.error;

      const deletePlaylistResult = await playlistRepository.delete(current.id);
      if (deletePlaylistResult.isErr()) throw deletePlaylistResult.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.cover(playlistId.value) });
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
        const coverResult = await coverRepository.upsertPlaylistCover(
          current.id,
          changes.coverBlob,
        );
        if (coverResult.isErr()) throw coverResult.error;
      }
      else if (changes.removeCover) {
        const deleteCoverResult = await coverRepository.deletePlaylistCover(current.id);
        if (deleteCoverResult.isErr()) throw deleteCoverResult.error;
      }

      if (Object.keys(updateData).length > 0) {
        const result = await playlistRepository.update(current.id, updateData);
        if (result.isErr()) throw result.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(playlistId.value) });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists.cover(playlistId.value) });
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
