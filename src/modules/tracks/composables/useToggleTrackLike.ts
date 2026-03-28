import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Track } from "@/modules/player/types";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { toggleTrackLikeAndSync } from "@/queries/track.queries";

export function useToggleTrackLike() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: async (track: Track) => {
      const nextTrack = await toggleTrackLikeAndSync(queryClient, track);
      track.isLiked = nextTrack.isLiked;
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
