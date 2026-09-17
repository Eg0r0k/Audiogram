import { queryOptions, skipToken, type QueryClient } from "@tanstack/vue-query";
import { trackRepository } from "@/db/repositories";
import type { TrackEntity } from "@/db/entities";
import { TrackId } from "@/types/ids";
import { settleLibraryReads } from "./cache";
import { queryKeys } from "./query-keys";
import { unwrapResult } from "./shared";

const NO_REMOTE_ID = TrackId("__local-copy-none__");

/** Imperative read for callers outside a component's query (menus, exports). */
export const getLocalCopy = async (remoteId: TrackId): Promise<TrackEntity | null> =>
  (await unwrapResult(trackRepository.findBySourceRef(remoteId))) ?? null;

/** The copy row appeared (`null`: was deleted); publishes it without a re-read. */
export const syncLocalCopyCache = async (
  queryClient: QueryClient,
  remoteId: TrackId,
  copy: TrackEntity | null,
): Promise<void> => {
  await settleLibraryReads(queryClient);
  queryClient.setQueryData(queryKeys.tracks.localCopy(remoteId), copy);
};

export const localCopyQueries = {
  /** Pass null to skip (local tracks and ephemeral subjects have no remote id). */
  byRemoteId: (remoteId: TrackId | null) =>
    queryOptions({
      queryKey: queryKeys.tracks.localCopy(remoteId ?? NO_REMOTE_ID),
      queryFn: remoteId ? () => getLocalCopy(remoteId) : skipToken,
    }),
} as const;
