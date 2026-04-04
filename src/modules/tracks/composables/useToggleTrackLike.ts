import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Track } from "@/modules/player/types";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { toggleTrackLikeAndSync } from "@/queries/track.queries";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useQueueStore } from "@/modules/queue/store/queue.store";

export function useToggleTrackLike() {
  const queryClient = useQueryClient();
  const playerStore = usePlayerStore();
  const queueStore = useQueueStore();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: async (track: Track) => {
      const nextTrack = await toggleTrackLikeAndSync(queryClient, track);

      track.isLiked = nextTrack.isLiked;

      if (playerStore.currentTrack?.id === nextTrack.id && "artistId" in playerStore.currentTrack) {
        playerStore.currentTrack = {
          ...playerStore.currentTrack,
          isLiked: nextTrack.isLiked,
        };
      }

      queueStore.syncTrackMetadata(nextTrack);

      return nextTrack;
    },
    onError: () => {
      toast.error(t("track.likeToggleFailed"));
    },
  });

  return {
    toggleTrackLike: mutation.mutateAsync,
    isTogglingLike: mutation.isPending,
  };
}
