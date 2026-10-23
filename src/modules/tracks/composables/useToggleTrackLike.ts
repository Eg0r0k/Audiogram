import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import type { Track } from "@/modules/player/types";
import { reportError } from "@/app/error-feedback";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { toggleTrackLike, type ToggleTrackLikeDeps } from "@/modules/tracks/service/toggleTrackLike";

export const useToggleTrackLike = () => {
  const queueStore = useQueueStore();
  const { t } = useI18n();
  const deps: ToggleTrackLikeDeps = {
    queryClient: useQueryClient(),
    syncTrackMetadata: track => queueStore.syncTrackMetadata(track),
  };

  const toggleWithFeedback = async (track: Track): Promise<Track> => {
    try {
      return await toggleTrackLike(track, deps);
    }
    catch (error) {
      reportError(error, {
        title: t("track.likeToggleFailed"),
        scope: "Tracks",
        retry: () => {
          toggleWithFeedback(track).catch(() => undefined);
        },
      });
      throw error;
    }
  };

  return { toggleTrackLike: toggleWithFeedback };
};
