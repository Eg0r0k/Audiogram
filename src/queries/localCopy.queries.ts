import { queryOptions, skipToken } from "@tanstack/vue-query";
import { trackRepository } from "@/db/repositories";
import type { TrackEntity } from "@/db/entities";
import { TrackId } from "@/types/ids";
import { queryKeys } from "./query-keys";

const NO_REMOTE_ID = TrackId("__local-copy-none__");

/** Imperative read for callers outside a component's query (menus, exports). */
export const getLocalCopy = async (remoteId: TrackId): Promise<TrackEntity | null> =>
  (await trackRepository.findBySourceRef(remoteId)) ?? null;

export const localCopyQueries = {
  /** Pass null to skip (local tracks and ephemeral subjects have no remote id). */
  byRemoteId: (remoteId: TrackId | null) =>
    queryOptions({
      queryKey: queryKeys.tracks.localCopy(remoteId ?? NO_REMOTE_ID),
      queryFn: remoteId ? () => getLocalCopy(remoteId) : skipToken,
    }),
} as const;
