import type { ContextActions, TrackContext } from "@/components/track/context-menu/types";
import { usePlayerStore } from "@/stores/player.store";
import { useQueueStore } from "@/stores/queue.store";
import { PlaylistId } from "@/types/ids";
import { Track } from "@/types/track/track";
import { useRouter } from "vue-router";

interface RefLike<T> {
  value: T;
}

export const useTrackContextActions = (
  track: RefLike<Track>,
  context: RefLike<TrackContext>,
  options: {
    playlistId?: RefLike<PlaylistId | undefined>;
    queueIndex?: RefLike<number | undefined>;
  } = {},
): ContextActions => {
  const router = useRouter();
  const playerStore = usePlayerStore();
  const queueStore = useQueueStore();

  const play = () => {
    console.log("not implemented");
  };
  const playNext = () => {
    console.log("not implemented");
  };

  const addToQueue = () => {
    console.log("not implemented");
  };

  const toggleLike = async () => {
    console.log("Toggle like:", track.value.id);
  };

  const addToPlaylist = async (playlistId: PlaylistId) => {
    console.log("Add to playlist:", track.value.id, "->", playlistId);
  };

  const removeFromQueue = () => {
    if (options.queueIndex?.value !== undefined) {
      console.log("Remove from queue at index:", options.queueIndex.value);
    }
  };

  const removeFromPlaylist = async () => {
    if (options.playlistId?.value) {
      console.log("Remove from playlist:", options.playlistId.value);
    }
  };

  const removeFromHistory = async () => {
    console.log("Remove from history:", track.value.id);
  };

  const goToArtist = () => {
    router.push(`/artist/${track.value.artistId}`);
  };

  const goToAlbum = () => {
    router.push(`/album/${track.value.albumId}`);
  };

  const download = () => {
    // TODO: Download service
    console.log("Download:", track.value.id);
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
