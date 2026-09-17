import type { OfflineCopyEntity } from "@/db/entities";
import { storageService } from "@/db/storage";
import { getLogger } from "@/lib/logger";
import { queryClient } from "@/queries/client";
import { getLocalCopy, syncLocalCopyCache } from "@/queries/localCopy.queries";
import { syncOfflineCopyCache } from "@/queries/offlineCopy.queries";
import { deleteTracksAndSync } from "@/queries/track.queries";
import type { TrackId } from "@/types/ids";

/**
 * Post-commit half of a legacy offlineCopies row purge inside the generic
 * track-delete cascade (track-cascade.ts / track-undo.ts): best-effort file
 * deletion + point cache sync. Must run strictly AFTER the Dexie transaction
 * — file IO inside it would commit it prematurely. Retired with the
 * offlineCopies store in Task 8.
 */
export async function cleanupOfflineCopyFiles(copies: readonly OfflineCopyEntity[]): Promise<void> {
  for (const copy of copies) {
    const deleted = await storageService.deleteFile(copy.storagePath);
    if (deleted.isErr()) {
      getLogger().warn(`[Downloads] Failed to delete offline copy file: ${deleted.error.message}`);
    }
    await syncOfflineCopyCache(queryClient, copy.trackId, null);
  }
}

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
