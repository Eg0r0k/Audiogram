import type { DownloadJobEntity, TrackEntity } from "@/db/entities";
import { albumRepository, coverRepository, trackRepository } from "@/db/repositories";
import { getLogger } from "@/lib/logger";
import { trackCoverOwner } from "@/modules/covers/composables/useTrackCover";
import { queryClient } from "@/queries/client";
import { invalidateLibraryData } from "@/queries/library.queries";
import { syncLocalCopyCache } from "@/queries/localCopy.queries";
import { unwrapResult } from "@/queries/shared";
import { extensionOf } from "@/services/import/item-io";
import { musicLibraryEngine } from "@/services/importer.service";
import type { ImportItem, KnownMetadata } from "@/services/types";
import type { TrackId } from "@/types/ids";

/** The remote row's identity, which outranks whatever tags the file carries. */
const knownFrom = async (remoteId: TrackId, row: TrackEntity): Promise<KnownMetadata> => {
  const album = row.albumId ? await unwrapResult(albumRepository.findById(row.albumId)) : undefined;
  const owner = trackCoverOwner(row);
  const cover = owner ? await unwrapResult(coverRepository.findByOwner(owner.ownerType, owner.ownerId)) : undefined;

  return {
    sourceRef: remoteId,
    title: row.title,
    artistName: row.artistName || undefined,
    albumTitle: row.albumTitle || undefined,
    year: album?.year,
    trackNo: row.trackNo,
    discNo: row.diskNo,
    cover: cover?.blob,
  };
};

/**
 * Runs a downloaded file through the regular import with the shadow row's
 * identity, so it lands as a local track (artist/album merged by the import's
 * rules) with `sourceRef` back to the remote id. Returns the new local id, or
 * null when the pipeline skipped the file (same fingerprint already in the
 * library). Throws on a failed import.
 */
export const importDownloadedFile = async (remoteId: TrackId, absolutePath: string): Promise<TrackId | null> => {
  const row = await unwrapResult(trackRepository.findById(remoteId));
  if (!row) throw new Error(`No row to import from for ${remoteId}`);

  const name = absolutePath.split(/[\\/]/).pop() ?? `${remoteId}.bin`;
  const item: ImportItem = {
    type: "native",
    name,
    ext: extensionOf(name),
    path: absolutePath,
    fileSize: 0,
    known: await knownFrom(remoteId, row),
  };

  const result = await musicLibraryEngine.importFromItems([item]);
  if (result.failed.length > 0) throw result.failed[0].error;

  if (result.successful.length === 0) {
    getLogger().warn(`[Downloads] ${remoteId}: the file is already in the library (same fingerprint), nothing imported`);
    return null;
  }
  return result.successful[0].trackId;
};

/**
 * Turns a finished temp download into a library track (§2 of the spec) and
 * drops the temp file — the pipeline copies rather than moves.
 *
 * `file.format` is unused: the pipeline reads the real format off the file;
 * the parameter stays for the manager's finalizer call shape.
 */
export const finalizeDownloadImport = async (
  job: DownloadJobEntity,
  file: { path: string; format?: { codec?: string } },
): Promise<void> => {
  const localId = await importDownloadedFile(job.trackId, file.path);
  if (localId) {
    const copy = await unwrapResult(trackRepository.findById(localId));
    await syncLocalCopyCache(queryClient, job.trackId, copy ?? null);
    await invalidateLibraryData(queryClient);
  }

  try {
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(file.path);
  }
  catch (error) {
    // Best-effort: a stray temp file is reclaimed by the startup sweep.
    getLogger().warn(`[Downloads] Removing the temp file ${file.path} failed: ${String(error)}`);
  }
};
