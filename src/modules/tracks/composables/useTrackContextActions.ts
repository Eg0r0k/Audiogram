import type { Track } from "@/modules/player/types";
import type { ContextActions } from "@/modules/tracks/components/menu/type";
import { playlistRepository } from "@/db/repositories/playlist.repository";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { queryKeys } from "@/lib/query-keys";
import { PlaylistId } from "@/types/ids";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { Ref } from "vue";
import { useRouter } from "vue-router";

interface RefLike<T> {
  value: T;
}

export const useTrackContextActions = (
  track: Ref<Track | null>,
  options: {
    playlistId?: RefLike<PlaylistId | undefined>;
    queueIndex?: RefLike<number | null>;
  } = {},
): ContextActions => {
  const router = useRouter();
  const queueStore = useQueueStore();
  const playerStore = usePlayerStore();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const play = () => {
    if (!track.value) return;
    playerStore.playPlayerTrack(track.value);
  };

  const playNext = () => {
    if (!track.value) return;
    queueStore.insertNext(track.value);
  };

  const addToQueue = () => {
    if (!track.value) return;
    queueStore.addToQueue(track.value);
    toast.success(t("queue.added"));
  };

  const toggleLike = async () => {
    if (!track.value) return;
    // TODO: trackRepository.update(track.value.id, { isLiked: !track.value.isLiked })
    console.log("Toggle like:", track.value.id);
  };

  const addToPlaylist = async (playlistId: PlaylistId) => {
    if (!track.value) return;
    const result = await playlistRepository.addTrack(playlistId, track.value.id);
    if (result.isErr()) {
      toast.error(t("playlist.addTrackFailed"));
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(playlistId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
  };

  const removeFromQueue = () => {
    const idx = options.queueIndex?.value;
    if (idx == null) return;
    const item = queueStore.queue[idx];
    if (item) queueStore.removeFromQueue(item.id);
  };

  const removeFromPlaylist = async () => {
    if (!track.value || !options.playlistId?.value) return;
    const result = await playlistRepository.removeTrack(
      options.playlistId.value,
      track.value.id,
    );
    if (result.isErr()) {
      toast.error(t("playlist.removeTrackFailed"));
      return;
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(options.playlistId.value) });
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() });
  };

  const removeFromHistory = async () => {
    // TODO: history service
    console.log("Remove from history:", track.value?.id);
  };

  const goToArtist = () => {
    if (!track.value) return;
    router.push({ name: "artist", params: { id: track.value.artistId } });
  };

  const goToAlbum = () => {
    if (!track.value) return;
    router.push({ name: "album", params: { id: track.value.albumId } });
  };

  const download = () => {
    // TODO: download service
    console.log("Download:", track.value?.id);
  };

  return {
    play,
    playNext,
    addToQueue,
    toggleLike,
    addToPlaylist,
    removeFromQueue,
    removeFromPlaylist,
    removeFromHistory,
    goToArtist,
    goToAlbum,
    download,
  };
};
