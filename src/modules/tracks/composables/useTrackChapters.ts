import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { toaster } from "@/app/toaster";
import { trackChaptersQueries, saveTrackChapters } from "@/queries/trackChapters.queries";
import type { TrackChapterMark } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { getLogger } from "@/lib/logger";

interface ChaptersSave {
  trackId: TrackId;
  chapters: TrackChapterMark[];
}

const saveFailedToastId = (trackId: TrackId) => `chapters-save-failed:${trackId}`;

export function useTrackChapters(trackId: ComputedRef<TrackId>) {
  return useQuery(computed(() => trackChaptersQueries.detail(trackId.value)));
}

export function useSaveTrackChapters() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: ({ trackId, chapters }: ChaptersSave) => saveTrackChapters(queryClient, trackId, chapters),
    onSuccess: (_saved, { trackId }) => {
      toaster.remove(saveFailedToastId(trackId));
    },
    // Autosave has no button to put an error next to, so the failure is a
    // toast that waits; one per track, refreshed by every later failure.
    onError: (error, save) => {
      getLogger().error(`[Chapters] Saving chapters for ${save.trackId} failed: ${String(error)}`);
      toaster.add({
        id: saveFailedToastId(save.trackId),
        title: t("chapters.saveFailed"),
        color: "destructive",
        actions: [{
          label: t("common.retry"),
          onClick: () => {
            mutation.mutate(save);
          },
        }],
      });
    },
  });

  return mutation;
}
