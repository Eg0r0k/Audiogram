import { computed } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { QueueSource } from "@/modules/queue/types";

export function usePlaybackState(source: () => QueueSource) {
  const playerStore = usePlayerStore();
  const queueStore = useQueueStore();

  const isActiveSource = computed(() => {
    const current = queueStore.queue[queueStore.currentIndex.valueOf()]?.source;
    if (!current) return false;

    const s = source();

    if (s.type !== current.type) return false;

    switch (s.type) {
      case "album":
        return "albumId" in current && current.albumId === s.albumId;
      case "playlist":
        return "playlistId" in current && current.playlistId === s.playlistId;
      case "artist":
        return "artistId" in current && current.artistId === s.artistId;
      case "liked":
      case "search":
        return current.type === s.type;
      default:
        return false;
    }
  });

  const isPlaying = computed(() => isActiveSource.value && playerStore.isPlaying);
  const isLoading = computed(() => isActiveSource.value && playerStore.isLoading);

  return { isActiveSource, isPlaying, isLoading };
}
