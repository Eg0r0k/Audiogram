import type { Track } from "@/modules/player/types";
import type { ContextActions } from "@/modules/tracks/components/menu/type";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { PlaylistId, QueueItemId } from "@/types/ids";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { Ref } from "vue";
import { useRouter } from "vue-router";
import { useToggleTrackLike } from "./useToggleTrackLike";
import {
  addTrackToPlaylistAndSync,
  removeTrackFromPlaylistAndSync,
} from "@/queries/playlist.queries";

interface RefLike<T> {
  value: T;
}

export const useTrackContextActions = (
  track: Ref<Track | null>,
  options: {
    playlistId?: RefLike<PlaylistId | undefined>;
    queueIndex?: RefLike<number | null>;
    queueItemId?: RefLike<QueueItemId | null>;
  } = {},
): ContextActions => {
  const router = useRouter();
  const queueStore = useQueueStore();
  const playerStore = usePlayerStore();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { toggleTrackLike } = useToggleTrackLike();

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
    await toggleTrackLike(track.value);
  };
  const addToPlaylist = async (playlistId: PlaylistId) => {
    if (!track.value) return;
    try {
      await addTrackToPlaylistAndSync(queryClient, playlistId, track.value);
    }
    catch {
      toast.error(t("playlist.addTrackFailed"));
    }
  };

  const removeFromQueue = () => {
    const queueItemId = options.queueItemId?.value;
    if (!queueItemId) return;
    queueStore.removeFromQueue(queueItemId);
  };

  const removeFromPlaylist = async () => {
    if (!track.value || !options.playlistId?.value) return;
    try {
      await removeTrackFromPlaylistAndSync(
        queryClient,
        options.playlistId.value,
        track.value.id,
      );
    }
    catch {
      toast.error(t("playlist.removeTrackFailed"));
    }
  };

  const removeFromHistory = async () => {
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
