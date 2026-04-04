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
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { storageService } from "@/db/storage";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { IS_TAURI } from "@/lib/environment/userAgent";
import { useAttachTrackLyrics } from "./useAttachTrackLyrics";
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
  const { attachTrackLyrics } = useAttachTrackLyrics();
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

  const attachLyricsToTrack = async () => {
    if (!track.value) return;
    await attachTrackLyrics(track.value);
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

  const download = async () => {
    if (!track.value) return;

    const sourcePath = track.value.storagePath;
    const fallbackExt = sourcePath.split(".").pop()?.toLowerCase() ?? "mp3";
    const fileName = sourcePath.split(/[\\/]/).pop() ?? `${track.value.title}.${fallbackExt}`;

    try {
      const fileBlob = await (async () => {
        if (track.value && track.value.source.toString() && IS_TAURI && hasNativeSupport(storageService)) {
          const isAbsolutePath = /^(?:[a-zA-Z]:[\\/]|\/)/.test(sourcePath);

          if (isAbsolutePath) {
            const readResult = await storageService.readFile(sourcePath);
            if (readResult.isErr()) throw readResult.error;
            return new Blob([readResult.value]);
          }
        }

        const fileResult = await storageService.getFile(sourcePath);
        if (fileResult.isErr()) throw fileResult.error;
        return fileResult.value;
      })();

      if (IS_TAURI) {
        const targetPath = await save({
          defaultPath: fileName,
          filters: [{
            name: "Audio",
            extensions: [fallbackExt],
          }],
        });

        if (!targetPath) return;

        await writeFile(targetPath, new Uint8Array(await fileBlob.arrayBuffer()));
        toast.success(t("track.downloadSuccess"));
        return;
      }

      const objectUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(t("track.downloadSuccess"));
    }
    catch {
      toast.error(t("track.downloadFailed"));
    }
  };

  return {
    play,
    playNext,
    addToQueue,
    toggleLike,
    attachLyrics: attachLyricsToTrack,
    addToPlaylist,
    removeFromQueue,
    removeFromPlaylist,
    removeFromHistory,
    goToArtist,
    goToAlbum,
    download,
  };
};
