import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { useMutation } from "@tanstack/vue-query";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { useLiveQuery } from "@/composables/useLiveQuery";
import { readTrackChapters, saveTrackChapters } from "@/queries/trackChapters.queries";
import type { TrackChapterMark } from "@/db/entities";
import type { TrackId } from "@/types/ids";

interface ChaptersSave {
  trackId: TrackId;
  chapters: TrackChapterMark[];
}

const saveFailedToastId = (trackId: TrackId) => `chapters-save-failed:${trackId}`;

export function useTrackChapters(trackId: ComputedRef<TrackId>) {
  const live = useLiveQuery(async () => readTrackChapters(trackId.value), () => [trackId.value]);
  // The previous track's chapters stay until the next read lands; they are not this track's.
  return { ...live, data: computed(() => (live.isStale.value ? undefined : live.data.value)) };
}

export function useSaveTrackChapters() {
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: ({ trackId, chapters }: ChaptersSave) => saveTrackChapters(trackId, chapters),
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
