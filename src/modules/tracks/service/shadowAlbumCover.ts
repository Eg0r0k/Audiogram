import type { CoverOwnerType } from "@/db/entities";
import { coverRepository } from "@/db/repositories";
import { getLogger } from "@/lib/logger";
import { THUMB_SIZE_FULL } from "@/lib/media/cover-sizes";
import { sources } from "@/modules/sources";
import type { TrackId } from "@/types/ids";
import { parseTrackRef } from "@/types/track-ref";
import { updateCoverCache } from "@/queries/cache";
import { unwrapResult } from "@/queries/shared";

/**
 * Gives a freshly pinned remote row its artwork: fetches the source-proxied
 * image for `coverRef` and stores the blob under the owner `trackCoverOwner`
 * picked — the shadow album when the track has one, otherwise the track
 * itself. Idempotent (an existing cover wins) and strictly best-effort — a
 * failed fetch leaves the row cover-less and is logged, never breaks the pin.
 */
export async function ensureShadowCover(
  ownerType: CoverOwnerType,
  ownerId: string,
  coverRef: string,
): Promise<void> {
  const kind = parseTrackRef(ownerId as TrackId).kind;
  if (kind === "local") return;

  try {
    const existing = await unwrapResult(coverRepository.findByOwner(ownerType, ownerId));
    if (existing) return;

    // The stored blob is the ONLY rendition the row ever shows (hero, now
    // playing, cards), so it is fetched at the full size — a source's own
    // no-size default may be a small list thumbnail.
    const response = await fetch(sources.get(kind).coverUrl(coverRef, THUMB_SIZE_FULL));
    if (!response.ok) {
      getLogger().warn(`[Covers] Shadow cover for ${ownerType} ${ownerId} answered HTTP ${response.status}`);
      return;
    }
    const blob = await response.blob();
    if (blob.size === 0) return;

    const stored = await unwrapResult(coverRepository.upsertOwnerCover(ownerType, ownerId, blob));
    // Surfaces mounted before the fetch landed hold a cached null.
    updateCoverCache(ownerType, ownerId, stored);
  }
  catch (error) {
    getLogger().warn(`[Covers] Shadow cover failed for ${ownerType} ${ownerId}: ${String(error)}`);
  }
}
