import { storageService } from "@/db/storage";
import { getLogger } from "@/lib/logger";
import { queryClient } from "@/queries/client";
import { getLocalCopy, syncLocalCopyCache } from "@/queries/localCopy.queries";
import { deleteTracksAndSync } from "@/queries/track.queries";
import type { TrackId } from "@/types/ids";

/**
 * "Remove download": the copy IS a local track, so this is the regular track
 * deletion plus the file. The remote shadow row is untouched — the id streams
 * again and keeps its likes/history.
 */
export const removeLocalCopy = async (remoteId: TrackId): Promise<void> => {
  const copy = await getLocalCopy(remoteId);
  if (!copy) return;

  await deleteTracksAndSync(queryClient, [copy.id]);
  await syncLocalCopyCache(queryClient, remoteId, null);

  // File deletion strictly after the DB transaction.
  if (copy.storagePath) {
    const deleted = await storageService.deleteFile(copy.storagePath);
    if (deleted.isErr()) {
      getLogger().warn(`[Downloads] Failed to delete the downloaded file: ${deleted.error.message}`);
    }
  }
};
