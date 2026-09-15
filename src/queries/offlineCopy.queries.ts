import { queryOptions, skipToken, type QueryClient } from "@tanstack/vue-query";
import { offlineCopyRepository } from "@/db/repositories";
import type { OfflineCopyEntity } from "@/db/entities";
import { TrackId } from "@/types/ids";
import { settleLibraryReads } from "./cache";
import { queryKeys } from "./query-keys";
import { unwrapResult } from "./shared";

const NO_TRACK_ID = TrackId("__offline-copy-none__");

/** The copy row was written (`null`: deleted); publishes it without a re-read. */
export const syncOfflineCopyCache = async (
  queryClient: QueryClient,
  trackId: TrackId,
  copy: OfflineCopyEntity | null,
): Promise<void> => {
  await settleLibraryReads(queryClient);
  queryClient.setQueryData(queryKeys.offlineCopies.detail(trackId), copy);
};

/** Imperative read for callers outside a component's query (exports, menus). */
export async function getOfflineCopy(trackId: TrackId): Promise<OfflineCopyEntity | null> {
  return (await unwrapResult(offlineCopyRepository.findById(trackId))) ?? null;
}

export const offlineCopyQueries = {
  /** Pass null to skip (local tracks and ephemeral subjects have no copies). */
  detail: (trackId: TrackId | null) =>
    queryOptions({
      queryKey: queryKeys.offlineCopies.detail(trackId ?? NO_TRACK_ID),
      queryFn: trackId
        ? async (): Promise<OfflineCopyEntity | null> =>
          (await unwrapResult(offlineCopyRepository.findById(trackId))) ?? null
        : skipToken,
    }),
} as const;
