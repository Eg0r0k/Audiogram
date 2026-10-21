import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { trackChaptersQueries, saveTrackChapters } from "@/queries/trackChapters.queries";
import type { TrackChapterMark } from "@/db/entities";
import type { TrackId } from "@/types/ids";

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
      reportError(error, {
        title: t("chapters.saveFailed"),
        scope: "Chapters",
        id: saveFailedToastId(save.trackId),
        retry: () => {
          mutation.mutate(save);
        },
      });
    },
  });

  return mutation;
}
