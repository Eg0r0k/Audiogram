import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useTrackContextActions } from "@/modules/tracks/composables/useTrackContextActions";
import { useEphemeralImport } from "@/modules/tracks/composables/useEphemeralImport";
import { useTrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import type { TrackMenuFacts } from "@/modules/tracks/lib/trackMenu";
import type { PlaylistId } from "@/types/ids";
import type { TrackContext, TrackMenuActions } from "../type";

export interface TrackMenuContentOptions {
  context: MaybeRefOrGetter<TrackContext>;
  playlistId?: MaybeRefOrGetter<PlaylistId | undefined>;
  isPlaylistOwner?: MaybeRefOrGetter<boolean>;
  onNavigate?: () => void;
}

/**
 * The part of a track menu shell that does not depend on how it is shown:
 * what the menu model needs to know about the active subject and the
 * actions its entries run. Context menu, dropdown and the mobile sheet all
 * share it.
 */
export const useTrackMenuContent = (options: TrackMenuContentOptions) => {
  const { activeSubject, activeTrack, activeIndex, activeQueueItemId } = useTrackMenu();
  const downloadsStore = useDownloadsStore();
  const { importCurrent } = useEphemeralImport(activeTrack);

  const actions: TrackMenuActions = {
    ...useTrackContextActions(activeTrack, {
      playlistId: () => toValue(options.playlistId),
      queueIndex: activeIndex,
      queueItemId: activeQueueItemId,
      subject: activeSubject,
      onNavigate: options.onNavigate,
      // The sheet stays open after its header buttons, so the shown state follows.
      onTrackChange: (next) => {
        if (activeTrack.value?.id === next.id) activeTrack.value = next;
      },
    }),
    importToLibrary: importCurrent,
  };

  const caps = useTrackMenuCaps(activeSubject);

  const input = computed<TrackMenuFacts | null>(() => {
    const track = activeTrack.value;
    if (!track) return null;
    const { trackId } = caps.value;
    return {
      context: toValue(options.context),
      track,
      caps: caps.value,
      job: trackId ? downloadsStore.byTrackId[trackId] ?? null : null,
      isPlaylistOwner: toValue(options.isPlaylistOwner) ?? false,
    };
  });

  return { input, actions };
};
