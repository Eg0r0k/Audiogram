import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { PlaylistId } from "@/types/ids";
import { formatTotalDuration } from "@/lib/format/time";
import { useI18n } from "vue-i18n";
import { usePlaylistCover } from "@/modules/covers/composables/usePlaylistCover";
import { PlaylistData } from "@/modules/media-hero/types";
import {
  deletePlaylistAndSync,
  playlistQueries,
  removeTrackFromPlaylistAndSync,
  type PlaylistChanges,
  updatePlaylistAndSync,
} from "@/queries/playlist.queries";

export type { PlaylistChanges } from "@/queries/playlist.queries";

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
  } = useQuery(computed(() => playlistQueries.page(playlistId.value)));

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
    mutationFn: () => deletePlaylistAndSync(queryClient, playlist.value),
    onSuccess: () => {
      router.push("/library");
    },
  });

  const { mutateAsync: updatePlaylist } = useMutation({
    mutationFn: async (changes: PlaylistChanges) => {
      const current = playlist.value;
      if (!current) {
        return;
      }

      return updatePlaylistAndSync(queryClient, current, changes);
    },
  });

  const { mutateAsync: removeTrack } = useMutation({
    mutationFn: (trackId: string) =>
      removeTrackFromPlaylistAndSync(
        queryClient,
        playlistId.value,
        trackId,
      ),
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
