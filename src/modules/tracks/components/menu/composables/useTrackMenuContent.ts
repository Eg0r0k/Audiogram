import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useTrackContextActions } from "@/modules/tracks/composables/useTrackContextActions";
import { useTrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { PlaylistId } from "@/types/ids";
import { trackContextComponents } from "../contexts";
import type { TrackContext } from "../type";

export interface TrackMenuContentOptions {
  context: MaybeRefOrGetter<TrackContext>;
  playlistId?: MaybeRefOrGetter<PlaylistId | undefined>;
  isPlaylistOwner?: MaybeRefOrGetter<boolean>;
  onNavigate?: () => void;
}

/**
 * The part of a track menu shell that does not depend on how it is shown:
 * which context component renders for the active subject and the props it
 * receives. Context menu, dropdown and the mobile sheet all share it.
 */
export const useTrackMenuContent = (options: TrackMenuContentOptions) => {
  const { activeSubject, activeTrack, activeIndex, activeQueueItemId } = useTrackMenu();
  const queueStore = useQueueStore();

  const contextComponent = computed(() => trackContextComponents[toValue(options.context)]);

  const actions = useTrackContextActions(activeTrack, {
    playlistId: () => toValue(options.playlistId),
    queueIndex: activeIndex,
    queueItemId: activeQueueItemId,
    subject: activeSubject,
    onNavigate: options.onNavigate,
  });

  // Computed once per active subject; contexts receive ready-made booleans.
  const caps = useTrackMenuCaps(activeSubject);

  const contextProps = computed(() => {
    if (!activeTrack.value) return {};

    const base = { track: activeTrack.value, actions, caps: caps.value };

    switch (toValue(options.context)) {
      case "playlist":
        return {
          ...base,
          playlistId: toValue(options.playlistId),
          isOwner: toValue(options.isPlaylistOwner) ?? false,
        };
      case "queue":
        return {
          ...base,
          queueIndex: activeIndex.value ?? -1,
          queueLength: queueStore.size,
        };
      default:
        return base;
    }
  });

  return { activeTrack, contextComponent, contextProps };
};
