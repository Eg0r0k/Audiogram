import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { toaster } from "@/app/toaster";
import { getLogger } from "@/lib/logger";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { deleteTracksWithUndo } from "@/queries/track-undo";
import type { TrackId } from "@/types/ids";

export const useTrackDeletion = () => {
  const queryClient = useQueryClient();
  const queueStore = useQueueStore();
  const { t } = useI18n();
  const deleteWithUndo = async (ids: TrackId[], message: (deleted: number) => string): Promise<number> => {
    const idSet = new Set<string>(ids);
    const queueItemIds = queueStore.queue
      .filter(item => idSet.has(item.track.id))
      .map(item => item.id);

    const undo = await deleteTracksWithUndo(queryClient, ids);
    if (undo.deleted === 0) return 0;
    if (queueItemIds.length > 0) await queueStore.removeMultiple(queueItemIds);

    let undone = false;
    const finalize = () => {
      if (undone) return;
      undo.finalize().catch((error: unknown) => {
        getLogger().warn(`[Tracks] Finalizing a track deletion failed: ${String(error)}`);
      });
    };

    toaster.add({
      title: message(undo.deleted),
      color: "success",
      actions: [{
        label: t("common.undo"),
        onClick: () => {
          undone = true;
          undo.restore().catch((error: unknown) => {
            getLogger().error(`[Tracks] Restoring deleted tracks failed: ${String(error)}`);
            toaster.add({ title: t("track.restoreFailed"), color: "destructive" });
          });
        },
      }],
      onClose: finalize,
    });

    return undo.deleted;
  };

  return { deleteWithUndo };
};
