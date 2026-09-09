import type { ListenOrigin, ListenPick } from "@/db/entities";
import type { QueueItem } from "@/modules/queue/types";
import type { TrackId } from "@/types/ids";

const isAutoplayItemFor = (item: QueueItem | null, trackId: TrackId): boolean =>
  item !== null && item.track.kind === "library" && item.track.id === trackId && item.source.type === "autoplay";

/**
 * Only a track the queue itself appended via autoplay counts as "autoplay":
 * a stale or mismatched queue item defaults to "user" so a race can never
 * mislabel a deliberate play as a machine pick.
 */
export const resolveListenOrigin = (item: QueueItem | null, trackId: TrackId): ListenOrigin =>
  isAutoplayItemFor(item, trackId) ? "autoplay" : "user";

/** The autoplay pick tag for this track's queue item, if it was an autoplay pick at all. */
export const resolveListenPick = (item: QueueItem | null, trackId: TrackId): ListenPick | undefined =>
  item && isAutoplayItemFor(item, trackId) && item.source.type === "autoplay" ? item.source.pick : undefined;
