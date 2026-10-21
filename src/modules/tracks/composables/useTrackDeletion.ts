import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { formatError } from "@/lib/errors";
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
        getLogger().warn(`[Tracks] Finalizing a track deletion failed: ${formatError(error)}`);
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
            reportError(error, { title: t("track.restoreFailed"), scope: "Tracks" });
          });
        },
      }],
      onClose: finalize,
    });

    return undo.deleted;
  };

  return { deleteWithUndo };
};
