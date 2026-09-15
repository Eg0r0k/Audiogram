import type { CoverEntity, CoverOwnerType } from "@/db/entities";
import { coverRepository } from "@/db/repositories";
import { unwrapResult } from "./shared";

/** What the cover cache keeps of a row: the bytes and the stamp that tells two reads of the same row apart. */
export type CoverRow = Pick<CoverEntity, "blob" | "updatedAt">;

/**
 * The covers of `ownerIds` (one owner type) as one index read; owners without
 * a cover are absent. The only read path into Dexie covers — consumers go
 * through the cover cache (modules/covers/lib/cover-cache.ts), which batches
 * and holds the results.
 */
export async function getCoversByOwners(
  ownerType: CoverOwnerType,
  ownerIds: readonly string[],
): Promise<Map<string, CoverRow>> {
  const covers = await unwrapResult(coverRepository.findByOwners(ownerType, ownerIds));
  return new Map(covers.map(cover => [cover.ownerId, { blob: cover.blob, updatedAt: cover.updatedAt }]));
}
