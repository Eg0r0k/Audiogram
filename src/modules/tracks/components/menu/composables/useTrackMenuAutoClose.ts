import { computed, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import { useLiveQuery } from "@/composables/useLiveQuery";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { isLibraryTrack } from "@/types/track";
import { getPlaylistLibraryRow } from "@/queries/playlist.queries";
import type { PlaylistId } from "@/types/ids";
import type { TrackContext } from "../type";

export function useTrackMenuAutoClose(
  isOpen: Ref<boolean>,
  options: {
    context: MaybeRefOrGetter<TrackContext>;
    playlistId?: MaybeRefOrGetter<PlaylistId | undefined>;
  },
) {
  const { activeTrack, activeQueueItemId, closeMenu, closeDropdown } = useTrackMenu();
  const queueStore = useQueueStore();

  const playlistId = computed(() => toValue(options.playlistId));
  const livePlaylist = useLiveQuery(
    async () => (playlistId.value ? getPlaylistLibraryRow(playlistId.value) : null),
    () => [playlistId.value],
    { enabled: () => playlistId.value !== undefined },
  );

  const isEntityGone = computed(() => {
    if (!isOpen.value) return false;
    const track = activeTrack.value;
    if (!track) return false;

    switch (toValue(options.context)) {
      case "queue": {
        const itemId = activeQueueItemId.value;
        if (!itemId) return false;
        // The whole queue, not just the upcoming slice: the now-playing row
        // opens this menu too, and its item sits at currentIndex.
        return !queueStore.queue.some(item => item.id === itemId);
      }
      case "playlist": {
        if (!isLibraryTrack(track)) return false;
        const playlist = livePlaylist.data.value;
        if (!playlist || playlist.id !== playlistId.value) return false;
        return !playlist.trackIds.includes(track.id);
      }
      default:
        return false;
    }
  });

  watch(isEntityGone, (gone) => {
    if (!gone) return;
    closeMenu();
    closeDropdown();
  });
}
