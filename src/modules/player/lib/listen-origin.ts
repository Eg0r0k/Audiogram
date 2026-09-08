import type { ListenOrigin } from "@/db/entities";
import type { QueueItem } from "@/modules/queue/types";
import type { TrackId } from "@/types/ids";

/**
 * Only a track the queue itself appended via autoplay counts as "autoplay":
 * a stale or mismatched queue item defaults to "user" so a race can never
 * mislabel a deliberate play as a machine pick.
 */
export const resolveListenOrigin = (item: QueueItem | null, trackId: TrackId): ListenOrigin => {
  if (!item || item.track.kind !== "library" || item.track.id !== trackId) return "user";
  return item.source.type === "autoplay" ? "autoplay" : "user";
};
