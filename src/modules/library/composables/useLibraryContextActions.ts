import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";
import { AlbumId, PlaylistId } from "@/types/ids";
import { getLogger } from "@/lib/logger";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { sources } from "@/modules/sources";
import { sourceKindOf, sourceTrackToDisplay } from "@/modules/sources/lib/display";
import { enqueueCollectionDownload } from "@/modules/downloads/service/enqueue";
import type { LibraryItem } from "../types";
import { getAlbumPageData } from "@/queries/album.queries";
import { getPlaylistPageData } from "@/queries/playlist.queries";
import { getAllTracksForQueue, getLikedTracksPageData } from "@/queries/track.queries";

export function useLibraryContextActions() {
  const queueStore = useQueueStore();
  const { t } = useI18n();

  const addToQueue = async (item: LibraryItem) => {
    switch (item.type) {
      case "artist":
      case "radio":
        return;

      case "album": {
        const { tracks } = await getAlbumPageData(AlbumId(item.id));
        if (tracks.length === 0) return;

        queueStore.addMultipleToQueue(tracks, {
          type: "album",
          albumId: AlbumId(item.id),
        });
        break;
      }

      case "playlist": {
        const { tracks } = await getPlaylistPageData(PlaylistId(item.id));
        if (tracks.length === 0) return;

        queueStore.addMultipleToQueue(tracks, {
          type: "playlist",
          playlistId: PlaylistId(item.id),
        });
        break;
      }

      case "liked": {
        const { tracks } = await getLikedTracksPageData();
        if (tracks.length === 0) return;

        queueStore.addMultipleToQueue(tracks, {
          type: "liked",
        });
        break;
      }

      case "allMedia": {
        const tracks = await getAllTracksForQueue("date_added_desc");
        if (tracks.length === 0) return;

        queueStore.addMultipleToQueue(tracks, {
          type: "allMedia",
        });
        break;
      }

      case "folder":
        return;
    }

    toaster.add({ title: t("queue.added"), color: "success" });
  };

  /**
   * Catalog row: tracks come from the source, not Dexie. Queueing
   * shadow-pins them on play, exactly like the catalog album page. The
   * source comes from the row's own branded id — these cards are not
   * Navidrome-only any more.
   */
  const addCatalogToQueue = async (item: LibraryItem) => {
    const kind = sourceKindOf(item.id);
    if (kind === "local") return;

    const provider = sources.get(kind);
    const result = item.type === "album"
      ? await provider.getAlbum(AlbumId(item.id))
      : await provider.getPlaylist(PlaylistId(item.id));

    if (result.isErr()) {
      getLogger().error(`[Library] Queueing catalog ${item.type} ${item.id} failed: ${result.error.message}`);
      toaster.add({ title: t("queue.addFailed"), color: "destructive" });
      return;
    }

    const tracks = result.value.tracks.map(sourceTrackToDisplay);
    if (tracks.length === 0) return;

    queueStore.addMultipleToQueue(
      tracks,
      item.type === "album"
        ? { type: "album", albumId: AlbumId(item.id) }
        : { type: "playlist", playlistId: PlaylistId(item.id) },
    );
    toaster.add({ title: t("queue.added"), color: "success" });
  };

  /** Batch offline download of a catalog album/playlist. */
  const downloadCatalog = async (item: LibraryItem) => {
    try {
      const batchId = item.type === "album"
        ? await enqueueCollectionDownload("album", AlbumId(item.id))
        : await enqueueCollectionDownload("playlist", PlaylistId(item.id));
      if (!batchId) toaster.add({ title: t("media.nothingToDownload"), color: "info" });
    }
    catch (error) {
      getLogger().error(`[Library] Batch download of ${item.type} ${item.id} failed: ${String(error)}`);
      toaster.add({
        title: t("downloads.enqueueFailed"),
        color: "destructive",
        actions: [{
          label: t("common.retry"),
          onClick: () => {
            downloadCatalog(item).catch(() => undefined);
          },
        }],
      });
    }
  };

  return {
    addToQueue,
    addCatalogToQueue,
    downloadCatalog,
  };
}
