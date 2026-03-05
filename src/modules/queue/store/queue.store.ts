import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { QueueItemId } from "@/types/ids";
import type { PlayerTrack } from "@/modules/player/types";
import type { QueueItem, QueueSource } from "../types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { resolveTrackSource } from "../lib/resolveTrackSource";
import { fisherYatesShuffle } from "@/lib/shuffle";

const RESTART_THRESHOLD = 3;

export const useQueueStore = defineStore("queue", () => {
  const playerStore = usePlayerStore();

  const queue = ref<QueueItem[]>([]);
  const originalQueue = ref<QueueItem[]>([]);
  const currentIndex = ref(-1);
  const isShuffled = ref(false);

  const currentItem = computed<QueueItem | null>(() => {
    const idx = currentIndex.value;
    if (idx < 0 || idx >= queue.value.length) return null;
    return queue.value[idx];
  });

  const currentTrack = computed<PlayerTrack | null>(
    () => currentItem.value?.track ?? null,
  );

  const hasNext = computed(() => {
    if (queue.value.length === 0) return false;
    if (playerStore.repeatMode !== "off") return true;
    return currentIndex.value < queue.value.length - 1;
  });

  const hasPrevious = computed(() => {
    if (queue.value.length === 0) return false;
    if (playerStore.repeatMode === "all") return true;
    return currentIndex.value > 0;
  });

  const isEmpty = computed(() => queue.value.length === 0);

  const size = computed(() => queue.value.length);

  const upcomingItems = computed<QueueItem[]>(() => {
    if (currentIndex.value < 0) return queue.value;
    return queue.value.slice(currentIndex.value + 1);
  });

  const previousItems = computed<QueueItem[]>(() => {
    if (currentIndex.value <= 0) return [];
    return queue.value.slice(0, currentIndex.value);
  });

  function createItem(track: PlayerTrack, source: QueueSource): QueueItem {
    return {
      id: QueueItemId(crypto.randomUUID()),
      track,
      source,
      addedAt: Date.now(),
    };
  }

  async function playAtIndex(index: number): Promise<boolean> {
    if (index < 0 || index >= queue.value.length) return false;

    currentIndex.value = index;
    const item = queue.value[index];

    const resolved = await resolveTrackSource(item.track);

    if (!resolved) {
      console.error(`Failed to resolve source for track: ${item.track.title}`);
      return false;
    }

    playerStore.currentTrack = item.track;

    try {
      if (resolved.type === "file" && resolved.file) {
        await playerStore.playFile(resolved.file);
      }
      else if (resolved.type === "url" && resolved.url) {
        await playerStore.playUrl(resolved.url);
      }
      return true;
    }
    catch (err) {
      console.error("Failed to play track:", err);
      return false;
    }
  }

  async function skipToNextPlayable(maxAttempts: number = 3): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nextIdx = currentIndex.value + 1;

      if (nextIdx >= queue.value.length) {
        if (playerStore.repeatMode === "all") {
          const success = await playAtIndex(0);
          if (success) return;
        }
        playerStore.stop();
        return;
      }

      const success = await playAtIndex(nextIdx);
      if (success) return;
    }

    playerStore.stop();
  }

  async function setQueue(
    tracks: PlayerTrack[],
    startIndex: number = 0,
    source: QueueSource = { type: "unknown" },
  ): Promise<void> {
    if (tracks.length === 0) {
      clear();
      return;
    }

    const items = tracks.map(track => createItem(track, source));

    queue.value = items;
    originalQueue.value = [...items];
    isShuffled.value = false;

    const safeIndex = Math.max(0, Math.min(startIndex, items.length - 1));
    await playAtIndex(safeIndex);
  }

  function addToQueue(
    track: PlayerTrack,
    source: QueueSource = { type: "manual" },
  ): void {
    queue.value.push(createItem(track, source));
  }

  function addMultipleToQueue(
    tracks: PlayerTrack[],
    source: QueueSource = { type: "manual" },
  ): void {
    const items = tracks.map(t => createItem(t, source));
    queue.value.push(...items);
  }

  function insertNext(
    track: PlayerTrack,
    source: QueueSource = { type: "manual" },
  ): void {
    const insertAt = currentIndex.value >= 0
      ? currentIndex.value + 1
      : 0;

    queue.value.splice(insertAt, 0, createItem(track, source));
  }

  async function next(): Promise<void> {
    if (queue.value.length === 0) return;

    if (playerStore.repeatMode === "one") {
      await playAtIndex(currentIndex.value);
      return;
    }

    if (currentIndex.value < queue.value.length - 1) {
      const success = await playAtIndex(currentIndex.value + 1);
      if (!success) await skipToNextPlayable();
    }
    else if (playerStore.repeatMode === "all") {
      await playAtIndex(0);
    }
    else {
      playerStore.stop();
      currentIndex.value = -1;
    }
  }

  async function previous(): Promise<void> {
    if (queue.value.length === 0) return;

    if (playerStore.currentTime > RESTART_THRESHOLD) {
      playerStore.seekTo(0);
      return;
    }

    if (currentIndex.value > 0) {
      await playAtIndex(currentIndex.value - 1);
    }
    else if (playerStore.repeatMode === "all") {
      await playAtIndex(queue.value.length - 1);
    }
    else {
      playerStore.seekTo(0);
    }
  }

  async function jumpTo(index: number): Promise<void> {
    if (index < 0 || index >= queue.value.length) return;
    await playAtIndex(index);
  }

  async function jumpToId(id: QueueItemId): Promise<void> {
    const index = queue.value.findIndex(item => item.id === id);
    if (index >= 0) {
      await playAtIndex(index);
    }
  }

  function removeFromQueue(id: QueueItemId): void {
    const index = queue.value.findIndex(item => item.id === id);
    if (index === -1) return;

    const isCurrentlyPlaying = index === currentIndex.value;

    queue.value.splice(index, 1);

    if (queue.value.length === 0) {
      currentIndex.value = -1;
      playerStore.stop();
      return;
    }

    if (index < currentIndex.value) {
      currentIndex.value--;
    }
    else if (isCurrentlyPlaying) {
      if (currentIndex.value >= queue.value.length) {
        currentIndex.value = queue.value.length - 1;
      }
      playAtIndex(currentIndex.value);
    }
  }

  function removeMultiple(ids: QueueItemId[]): void {
    const idSet = new Set(ids);
    const currentItemId = currentItem.value?.id;
    const wasCurrentRemoved = currentItemId && idSet.has(currentItemId);

    queue.value = queue.value.filter(item => !idSet.has(item.id));

    if (queue.value.length === 0) {
      currentIndex.value = -1;
      playerStore.stop();
      return;
    }

    if (wasCurrentRemoved) {
      const safeIndex = Math.min(currentIndex.value, queue.value.length - 1);
      playAtIndex(safeIndex);
    }
    else if (currentItemId) {
      const newIndex = queue.value.findIndex(item => item.id === currentItemId);
      currentIndex.value = newIndex >= 0 ? newIndex : 0;
    }
  }

  function moveTrack(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= queue.value.length) return;
    if (toIndex < 0 || toIndex >= queue.value.length) return;

    const [item] = queue.value.splice(fromIndex, 1);
    queue.value.splice(toIndex, 0, item);

    if (fromIndex === currentIndex.value) {
      currentIndex.value = toIndex;
    }
    else if (fromIndex < currentIndex.value && toIndex >= currentIndex.value) {
      currentIndex.value--;
    }
    else if (fromIndex > currentIndex.value && toIndex <= currentIndex.value) {
      currentIndex.value++;
    }
  }

  function shuffle(): void {
    if (queue.value.length <= 1) return;

    if (!isShuffled.value) {
      originalQueue.value = [...queue.value];
    }

    const current = queue.value[currentIndex.value];
    const rest = queue.value.filter((_, i) => i !== currentIndex.value);
    const shuffled = fisherYatesShuffle(rest);

    queue.value = current ? [current, ...shuffled] : shuffled;
    currentIndex.value = current ? 0 : -1;
    isShuffled.value = true;
  }

  function unshuffle(): void {
    if (!isShuffled.value || originalQueue.value.length === 0) return;

    const currentId = currentItem.value?.id;
    queue.value = [...originalQueue.value];

    const newIndex = currentId
      ? queue.value.findIndex(item => item.id === currentId)
      : -1;

    currentIndex.value = newIndex >= 0 ? newIndex : 0;
    isShuffled.value = false;
  }

  function toggleShuffle(): void {
    if (isShuffled.value) {
      unshuffle();
    }
    else {
      shuffle();
    }
  }

  function clear(): void {
    queue.value = [];
    originalQueue.value = [];
    currentIndex.value = -1;
    isShuffled.value = false;
  }

  watch(
    () => playerStore.trackEndedSignal,
    (newVal) => {
      if (newVal === 0) return;
      next();
    },
  );

  return {
    queue,
    originalQueue,
    currentIndex,
    isShuffled,

    currentItem,
    currentTrack,
    hasNext,
    hasPrevious,
    isEmpty,
    size,
    upcomingItems,
    previousItems,

    setQueue,
    addToQueue,
    addMultipleToQueue,
    insertNext,
    next,
    previous,
    jumpTo,
    jumpToId,
    removeFromQueue,
    removeMultiple,
    moveTrack,
    shuffle,
    unshuffle,
    toggleShuffle,
    clear,
  };
});
