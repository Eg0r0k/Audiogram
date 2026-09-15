import type { TrackEntity } from "@/db/entities";
import { getLogger } from "@/lib/logger";
import { reportSourceError, reportSourceOk } from "@/modules/sources/lib/health";
import type { SourceError, SourceErrorKind } from "@/types/source-dto";
import type { SourceKind } from "@/types/track-ref";
import { isDescendingSort, trackSortField, type TrackSortKey } from "@/types/track-sort";
import type { Result } from "neverthrow";

export { unwrapResult } from "@/lib/result";

/**
 * Typed SourceError carried across the TanStack Query boundary. The client's
 * retry policy keys on this class: a failure of any other shape is never
 * retried.
 */
export class SourceQueryError extends Error {
  constructor(public readonly kind: SourceErrorKind, message: string) {
    super(message);
    this.name = "SourceQueryError";
  }
}

/**
 * unwrapResult's counterpart for the source-provider boundary. `kind` is what
 * makes a live request double as a health probe: the source that answered (or
 * refused) is the one the verdict is recorded against, so a view can say
 * "the password was rejected" instead of showing an empty list.
 */
export const unwrapSourceResult = async <T>(
  promise: PromiseLike<Result<T, SourceError>>,
  kind?: SourceKind,
): Promise<T> => {
  const result = await promise;

  if (result.isErr()) {
    getLogger().error(`[Source] ${result.error.kind}: ${result.error.message}`);
    if (kind) reportSourceError(kind, result.error);
    throw new SourceQueryError(result.error.kind, result.error.message);
  }

  if (kind) reportSourceOk(kind);
  return result.value;
};

export const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export const upsertById = <T extends { id: string }>(items: readonly T[], item: T): T[] => {
  const index = items.findIndex(candidate => candidate.id === item.id);

  if (index === -1) {
    return [...items, item];
  }

  const next = [...items];
  next[index] = item;
  return next;
};

export const removeById = <T extends { id: string }>(items: readonly T[], id: string): T[] =>
  items.filter(item => item.id !== id);

/**
 * In-memory counterpart of the repository's sorted reads, with the same
 * plain `<`/`>` comparison Dexie's `sortBy` uses, so a collection sorted
 * here pages in the same order as one sorted by index.
 */
export const sortTracks = (tracks: TrackEntity[], sortKey: TrackSortKey): TrackEntity[] => {
  const field = trackSortField(sortKey);
  const direction = isDescendingSort(sortKey) ? -1 : 1;

  return [...tracks].sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];
    if (valueA < valueB) return -direction;
    if (valueA > valueB) return direction;
    return 0;
  });
};
