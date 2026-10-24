import { computed, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { storageService } from "@/db/storage";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useAttachTrackLyrics } from "@/modules/tracks/composables/useAttachTrackLyrics";
import {
  attachTrackLyricsAndSync,
  detachTrackLyricsAndSync,
  getTrackEntityById,
  setTrackLyricsOffsetAndSync,
} from "@/queries/track.queries";
import { deleteOwnedLyricsFile } from "@/services/track-files";
import { useLyricsStore } from "../store/lyrics.store";
import { usePlayerStore } from "../store/player.store";
import { isLibraryTrack, type Track } from "../types";

let deletions = 0;

export const useLyricsActions = () => {
  const queryClient = useQueryClient();
  const queueStore = useQueueStore();
  const playerStore = usePlayerStore();
  const lyricsStore = useLyricsStore();
  const { t } = useI18n();
  const { attachTrackLyrics, isAttachingLyrics } = useAttachTrackLyrics();
  const running = ref(0);

  const isPending = computed(() => running.value > 0 || isAttachingLyrics.value);

  const run = async <T>(action: () => Promise<T>): Promise<T> => {
    running.value++;
    try {
      return await action();
    }
    finally {
      running.value--;
    }
  };

  const isPlaying = (track: Track) => {
    const current = playerStore.currentTrack;
    return isLibraryTrack(current) && current.id === track.id;
  };

  // The queue patch announces no track change, and a rewritten file keeps its path.
  const present = (next: Track) => {
    queueStore.syncTrackMetadata(next);
    if (!isPlaying(next)) return;
    lyricsStore.reload()
      .catch(error => getLogger().error(`[Lyrics] Reloading lyrics failed: ${formatError(error)}`));
  };

  const saveText = (track: Track, text: string, { resetOffset = false }: { resetOffset?: boolean } = {}): Promise<Track> =>
    run(async () => {
      try {
        const saved = await storageService.saveFile(`lyrics/${track.id}.lrc`, new Blob([text], { type: "text/plain" }));
        if (saved.isErr()) throw saved.error;

        const next = await attachTrackLyricsAndSync(queryClient, track, {
          lyricsPath: saved.value,
          lyricsFileName: null,
          lyricsOffsetMs: resetOffset ? 0 : undefined,
        });
        present(next);
        toaster.add({ title: t("lyrics.saved"), color: "success" });
        return next;
      }
      catch (error) {
        reportError(error, { title: t("lyrics.saveFailed"), scope: "Lyrics" });
        throw error;
      }
    });

  // The attach mutation reports its own failures.
  const attachFile = (track: Track): Promise<Track | null> => attachTrackLyrics(track).catch(() => null);

  const deleteLyrics = async (track: Track): Promise<void> => {
    const lyricsPath = track.lyricsPath;
    if (!lyricsPath) return;
    const snapshot = {
      lyricsPath,
      lyricsFileName: track.lyricsFileName ?? null,
      lyricsOffsetMs: track.lyricsOffsetMs ?? 0,
    };

    const detached = await run(() => detachTrackLyricsAndSync(queryClient, track)).catch((error: unknown) => {
      reportError(error, { title: t("lyrics.deleteFailed"), scope: "Lyrics" });
      return null;
    });
    if (!detached) return;
    present(detached);

    let undone = false;

    const restore = async () => {
      present(await run(() => attachTrackLyricsAndSync(queryClient, detached, snapshot)));
    };

    // New lyrics written while the toast was open reuse the same path.
    const purge = async () => {
      const row = await getTrackEntityById(track.id);
      if (row?.lyricsPath === lyricsPath) return;
      await deleteOwnedLyricsFile(lyricsPath);
    };

    toaster.add({
      id: `lyrics-deleted-${++deletions}`,
      title: t("lyrics.deleted"),
      color: "success",
      actions: [{
        label: t("common.undo"),
        onClick: () => {
          undone = true;
          restore().catch((error: unknown) => {
            reportError(error, { title: t("lyrics.restoreFailed"), scope: "Lyrics" });
          });
        },
      }],
      onClose: () => {
        if (undone) return;
        purge().catch((error: unknown) => {
          getLogger().warn(`[Lyrics] Deleting ${lyricsPath} failed: ${formatError(error)}`);
        });
      },
    });
  };

  const removeMissing = async (track: Track): Promise<void> => {
    try {
      present(await run(() => detachTrackLyricsAndSync(queryClient, track)));
    }
    catch (error) {
      reportError(error, { title: t("lyrics.removeFailed"), scope: "Lyrics" });
    }
  };

  const setOffset = (track: Track, offsetMs: number): Promise<Track> =>
    run(async () => {
      try {
        const next = await setTrackLyricsOffsetAndSync(queryClient, track, offsetMs);
        queueStore.syncTrackMetadata(next);
        return next;
      }
      catch (error) {
        reportError(error, { title: t("lyrics.timingSaveFailed"), scope: "Lyrics" });
        throw error;
      }
    });

  return { saveText, attachFile, deleteLyrics, removeMissing, setOffset, isPending };
};
