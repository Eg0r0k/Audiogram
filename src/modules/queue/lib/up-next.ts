import type { QueueItem, RepeatMode } from "../types";

export type UpNextEntry = { item: QueueItem; index: number };

export type UpNext
  = | { kind: "tracks"; entries: UpNextEntry[] }
    | { kind: "repeat-one"; entry: UpNextEntry }
    | { kind: "autoplay" }
    | { kind: "end" }
    | { kind: "none" };

export const resolveUpNext = (
  queue: readonly QueueItem[],
  currentIndex: number,
  repeatMode: RepeatMode,
  continuesAfterTail: boolean,
  limit = 3,
): UpNext => {
  if (currentIndex < 0 || currentIndex >= queue.length) return { kind: "none" };
  const current: UpNextEntry = { item: queue[currentIndex], index: currentIndex };

  if (repeatMode === "one") return { kind: "repeat-one", entry: current };

  if (repeatMode === "all") {
    const count = Math.min(limit, queue.length - 1);
    if (count <= 0) return { kind: "repeat-one", entry: current };
    const entries = Array.from({ length: count }, (_, offset) => {
      const index = (currentIndex + 1 + offset) % queue.length;
      return { item: queue[index], index };
    });
    return { kind: "tracks", entries };
  }

  const start = currentIndex + 1;
  const entries = queue
    .slice(start, start + limit)
    .map((item, offset) => ({ item, index: start + offset }));
  if (entries.length > 0) return { kind: "tracks", entries };
  return continuesAfterTail ? { kind: "autoplay" } : { kind: "end" };
};
