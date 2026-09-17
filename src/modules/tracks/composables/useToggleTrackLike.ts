import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Track } from "@/modules/player/types";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { toggleTrackLikeAndSync } from "@/queries/track.queries";
import { invalidateLibraryData } from "@/queries/library.queries";
import { unwrapSourceResult } from "@/queries/shared";
import { sources } from "@/modules/sources";
import { ensurePinned } from "@/modules/tracks/service/ensurePinned";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { sourceKindOfId } from "@/types/track-ref";

export function useToggleTrackLike() {
  const queryClient = useQueryClient();
  const queueStore = useQueueStore();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: async (track: Track) => {
      const liked = !track.isLiked;

      // A catalog row has no Dexie row until something pins it. A like needs
      // one to carry likedAt, but it is NOT library membership (§1): the row,
      // its album and its artist stay shadows and the artist link keeps
      // opening the catalog.
      if (track.sourceDto) {
        await ensurePinned({ kind: "remote", dto: track.sourceDto }, { pinned: 0 });
        if (liked) await invalidateLibraryData(queryClient);
      }

      // The source's own like list first: a refusal leaves the row as it was.
      const kind = sourceKindOfId(track.id);
      const provider = kind === "local" ? undefined : sources.find(kind);
      if (provider?.setTrackLiked) {
        await unwrapSourceResult(provider.setTrackLiked(track.id, liked), kind);
      }

      const nextTrack = await toggleTrackLikeAndSync(queryClient, track);

      track.isLiked = nextTrack.isLiked;

      // The now-playing UI reads the queue's copy of the current track.
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
