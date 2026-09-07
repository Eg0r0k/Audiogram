import type { PlayerTrack, RepeatMode } from "@/modules/player/types";
import { mapTrackEntityToPlayerTrack } from "@/modules/player/utils/trackEntity";
import { getLogger } from "@/lib/logger";
import type { TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import type { QueueItem } from "../types";

const AUTOPLAY_RECOMMENDATION_LIMIT = 5;

export type AutoplaySource = (
  sourceTrackId: TrackId,
  limit: number,
  additionalExcludeIds: TrackId[],
) => Promise<readonly { track: TrackEntity }[]>;

// Provided by the recommendations feature at bootstrap; the queue never
// imports it (ARCHITECTURE.md §3). Without a source autoplay is simply off.
let autoplaySource: AutoplaySource | null = null;

export const registerAutoplaySource = (source: AutoplaySource | null): void => {
  autoplaySource = source;
};

interface AutoplayDeps {
  repeatMode: () => RepeatMode;
  /** Playback order. */
  queue: () => readonly QueueItem[];
  currentIndex: () => number;
  currentItem: () => QueueItem | null;
  append: (tracks: PlayerTrack[]) => void;
}

/**
 * Extends the queue with recommendations when the last entry ends and
 * nothing repeats. One request at a time: a second caller while one is in
 * flight shares its result. The append is re-validated after the async
 * lookup — the user may have moved on meanwhile.
 */
export const createAutoplayRecommender = (deps: AutoplayDeps) => {
  let inFlight: Promise<boolean> | null = null;

  const isAtTail = () => deps.repeatMode() === "off" && deps.currentIndex() === deps.queue().length - 1;

  const append = async (): Promise<boolean> => {
    const source = autoplaySource;
    if (!source || !isAtTail()) return false;

    const sourceItem = deps.currentItem();
    if (!sourceItem || sourceItem.track.kind !== "library") return false;
    const sourceItemId = sourceItem.id;

    const upcomingLibraryIds = deps.queue()
      .slice(deps.currentIndex() + 1)
      .flatMap(item => item.track.kind === "library" ? [item.track.id] : []);
    const additionalExcludeIds = [...new Set(upcomingLibraryIds)];

    let recommendations: Awaited<ReturnType<AutoplaySource>>;
    try {
      recommendations = await source(
        sourceItem.track.id,
        AUTOPLAY_RECOMMENDATION_LIMIT,
        additionalExcludeIds,
      );
      if (recommendations.length < AUTOPLAY_RECOMMENDATION_LIMIT) {
        recommendations = await source(sourceItem.track.id, AUTOPLAY_RECOMMENDATION_LIMIT, []);
      }
    }
    catch (error) {
      getLogger().error(`[Queue] Failed to load autoplay recommendations: ${String(error)}`);
      return false;
    }

    if (deps.currentItem()?.id !== sourceItemId) return false;
    if (!isAtTail()) return false;

    const tracks = recommendations.map(({ track }) => mapTrackEntityToPlayerTrack(track));
    if (tracks.length === 0) return false;

    deps.append(tracks);
    return true;
  };

  const ensure = (): Promise<boolean> => {
    if (!inFlight) {
      inFlight = append().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };

  return { ensure };
};
