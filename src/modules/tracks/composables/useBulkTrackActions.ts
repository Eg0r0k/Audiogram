import { computed, ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";
import type { Track } from "@/modules/player/types";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { TrackSortKey } from "@/modules/tracks/types";
import { addTracksToPlaylistAndSync, createPlaylistAndSync } from "@/queries/playlist.queries";
import {
  getTracksByIdsSorted,
  setTracksLikedAndSync,
} from "@/queries/track.queries";
import { useTrackDeletion } from "@/modules/tracks/composables/useTrackDeletion";
import type { PlaylistId, TrackId } from "@/types/ids";

export type BulkTrackAction = "play" | "playNext" | "addToQueue" | "toggleLike" | "addToPlaylist" | "delete";

const FAILED_TITLE_KEYS: Record<BulkTrackAction, string> = {
  play: "library.selection.playFailed",
  playNext: "queue.addFailed",
  addToQueue: "queue.addFailed",
  toggleLike: "track.likeToggleFailed",
  addToPlaylist: "library.selection.addToPlaylistFailed",
  delete: "library.selection.deleteFailed",
};

export interface UseBulkTrackActionsOptions {
  selectedIds: ComputedRef<ReadonlySet<string>>;
  /** Loaded rows — the only place the like status of a selected id is known. */
  loadedTracks: Ref<Track[]> | ComputedRef<Track[]>;
  sortKey: Ref<TrackSortKey | null> | ComputedRef<TrackSortKey | null>;
  onDone?: (action: BulkTrackAction) => void;
}

export const useBulkTrackActions = (options: UseBulkTrackActionsOptions) => {
  const queryClient = useQueryClient();
  const queueStore = useQueueStore();
  const { t } = useI18n();
  const { deleteWithUndo } = useTrackDeletion();

  const busy = ref(false);

  const ids = () => [...options.selectedIds.value] as TrackId[];

  const allLiked = computed(() => {
    const selected = options.selectedIds.value;
    let known = 0;
    for (const track of options.loadedTracks.value) {
      if (!selected.has(track.id)) continue;
      known++;
      if (!track.isLiked) return false;
    }
    return known > 0;
  });

  const run = async (action: BulkTrackAction, fn: () => Promise<void>) => {
    if (busy.value || options.selectedIds.value.size === 0) return;
    busy.value = true;
    try {
      await fn();
      options.onDone?.(action);
    }
    catch (err) {
      reportError(err, { title: t(FAILED_TITLE_KEYS[action]), scope: "useBulkTrackActions" });
    }
    finally {
      busy.value = false;
    }
  };

  const fetchSelected = () => getTracksByIdsSorted(ids(), options.sortKey.value);

  const play = () => run("play", async () => {
    const tracks = await fetchSelected();
    if (tracks.length === 0) return;
    await queueStore.setQueue(tracks, 0, { type: "manual" });
  });

  const playNext = () => run("playNext", async () => {
    const tracks = await fetchSelected();
    queueStore.insertMultipleNext(tracks, { type: "manual" });
    toaster.add({ title: t("library.selection.addedToQueue", tracks.length), color: "success" });
  });

  const addToQueue = () => run("addToQueue", async () => {
    const tracks = await fetchSelected();
    queueStore.addMultipleToQueue(tracks, { type: "manual" });
    toaster.add({ title: t("library.selection.addedToQueue", tracks.length), color: "success" });
  });

  const toggleLike = () => run("toggleLike", async () => {
    const liked = !allLiked.value;
    const idList = ids();
    const changed = await setTracksLikedAndSync(queryClient, idList, liked);

    const idSet = new Set<string>(idList);
    queueStore.syncTracksMetadata(
      queueStore.queue
        .filter(item => item.track.kind === "library" && idSet.has(item.track.id))
        .map(item => ({ ...item.track, isLiked: liked })),
    );
    toaster.add({ title: t(liked ? "library.selection.liked" : "library.selection.unliked", changed), color: "success" });
  });

  const addToPlaylist = (playlistId: PlaylistId) => run("addToPlaylist", async () => {
    const tracks = await fetchSelected();
    await addTracksToPlaylistAndSync(queryClient, playlistId, tracks);
    toaster.add({ title: t("library.selection.addedToPlaylist", tracks.length), color: "success" });
  });

  const createPlaylist = () => run("addToPlaylist", async () => {
    const tracks = await fetchSelected();
    const playlist = await createPlaylistAndSync(queryClient);
    await addTracksToPlaylistAndSync(queryClient, playlist.id, tracks);
    toaster.add({ title: t("library.selection.addedToPlaylist", tracks.length), color: "success" });
  });

  const deleteSelected = async () => {
    if (busy.value || options.selectedIds.value.size === 0) return;

    await run("delete", async () => {
      await deleteWithUndo(ids(), deleted => t("library.selection.deleted", deleted));
    });
  };

  return {
    busy,
    allLiked,
    play,
    playNext,
    addToQueue,
    toggleLike,
    addToPlaylist,
    createPlaylist,
    deleteSelected,
  };
};
