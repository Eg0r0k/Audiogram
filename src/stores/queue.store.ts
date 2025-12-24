import { defineStore } from "pinia";
import { computed, ref } from "vue";
export const useQueueStore = defineStore("queue", () => {
  const currentIndex = ref(-1);
  const queue = ref([]);
  const originalQueue = ref([]);
  const isShuffled = ref(false);

  const currentItem = computed(() => currentIndex.value >= 0 && currentIndex.value < queue.value.length ? queue.value[currentIndex.value] : null);

  const currentTrack = computed(() => {
    return new Error("not implemet");
  });
  const hasNext = computed(() =>
    currentIndex.value < queue.value.length - 1,
  );

  const hasPrevious = computed(() =>
    currentIndex.value > 0,
  );
  const isEmpty = computed(() => queue.value.length === 0);

  const setQueue = () => {};

  const addToQueue = () => {
    throw new Error("not implemented");
  };

  const insertNext = () => {
    throw new Error("not implemented");
  };

  const addTrackToQueue = () => {};

  const playNext = () => {};

  const removeFromQueue = () => {};

  const removeTracksFormQueue = () => {};

  const next = () => {};

  const previous = () => {};

  const jumpTo = () => {};

  const suffle = () => {};

  const moveTrack = () => {};

  const clear = () => {
    queue.value = [];
    currentIndex.value = -1;
  };

  return {

    queue,
    currentIndex,
    originalQueue,
    isShuffled,
    currentTrack,
    hasNext,
    hasPrevious,
    currentItem,
    isEmpty,

    clear,
    moveTrack,
    next,
    previous,
    playNext,
    setQueue,
    addTrackToQueue,
    removeFromQueue,
    jumpTo,
    suffle,
    removeTracksFormQueue,
    addToQueue,
    insertNext,
  };
});
