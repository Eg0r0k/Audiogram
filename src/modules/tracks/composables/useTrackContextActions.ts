import { isLibraryTrack, type PlayerTrack, type Track } from "@/types/track";
import type { ContextActions, TrackMenuSubject } from "@/modules/tracks/components/menu/type";
import { ensurePinned } from "@/modules/tracks/service/ensurePinned";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import type { AlbumId, ArtistId, PlaylistId, QueueItemId, TrackId } from "@/types/ids";

import { useQueryClient } from "@tanstack/vue-query";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { formatError } from "@/lib/errors";
import { valueOrThrow } from "@/lib/errors/unwrap";
import { getLogger } from "@/lib/logger";
import { useI18n } from "vue-i18n";
import { toValue, type MaybeRefOrGetter } from "vue";
import { useRoute, useRouter } from "vue-router";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { storageService } from "@/db/storage";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { platformCaps } from "@/lib/environment/platformCaps";
import { fileNameFromPath } from "@/lib/files/path";
import { routeLocation } from "@/app/router/route-locations";
import { useAttachTrackLyrics } from "./useAttachTrackLyrics";
import { useToggleTrackLike } from "./useToggleTrackLike";
import { ephemeralRemoteDto, isRemoteTrack, trackHasLocalFile } from "@/modules/tracks/lib/trackPredicates";
import { promoteTrackToLibrary, removeTrackFromLibrary } from "@/modules/tracks/service/libraryMembership";
import { downloadSubject } from "@/modules/downloads/service/enqueue";
import { cancelTrackDownload } from "@/modules/downloads/service/manager";
import { removeLocalCopy } from "@/modules/downloads/service/removeCopy";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { invalidateLibraryData } from "@/queries/library.queries";
import { getLocalCopy } from "@/queries/localCopy.queries";
import { openUrl } from "@tauri-apps/plugin-opener";
import { parseTrackRef } from "@/types/track-ref";
import { trackIdFromStreamUrl } from "@/lib/stream-url";
import { sources } from "@/modules/sources";
import {
  addTrackToPlaylistAndSync,
  removeTrackFromPlaylistWithUndo,
} from "@/queries/playlist.queries";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { statsService } from "@/services/stats.service";

export const useTrackContextActions = (
  track: MaybeRefOrGetter<PlayerTrack | null>,
  options: {
    playlistId?: MaybeRefOrGetter<PlaylistId | undefined>;
    queueIndex?: MaybeRefOrGetter<number | null>;
    queueItemId?: MaybeRefOrGetter<QueueItemId | null>;
    /** Menu subject — lets DB-bound actions pin remote DTOs on demand. */
    subject?: MaybeRefOrGetter<TrackMenuSubject | null>;
    onNavigate?: () => void;
    /** A like or lyrics edit returns a new copy; a read-only snapshot cannot take it in place. */
    onTrackChange?: (track: Track) => void;
  } = {},
): ContextActions => {
  const router = useRouter();
  const route = useRoute();
  const queueStore = useQueueStore();
  const rightPanelStore = useRightPanelStore();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { attachTrackLyrics } = useAttachTrackLyrics();
  const { toggleTrackLike } = useToggleTrackLike();

  // Always through the queue: it owns the current track (like/lyrics edits
  // reach the now-playing UI via its copy) and a played track needs an
  // entry to advance from. An entry the track already has is jumped to —
  // the queue's own menu, or a track that is queued further down —
  // otherwise it goes right after the current entry and starts.
  const play = () => {
    const current = toValue(track);
    if (!current) return;
    const existingId = toValue(options.queueItemId)
      ?? queueStore.queue.find(item => item.track.kind === current.kind && item.track.id === current.id)?.id;
    const itemId = existingId ?? queueStore.insertNext(current).id;
    queueStore.jumpToId(itemId)
      .catch(error => getLogger().error(`[Queue] Jumping to a queue item failed: ${formatError(error)}`));
  };

  const playNext = () => {
    const current = toValue(track);
    if (!current) return;
    queueStore.insertNext(current);
  };

  const addToQueue = () => {
    const current = toValue(track);
    if (!current) return;
    queueStore.addToQueue(current);
  };

  /**
   * Resolves the track row a DB-bound action should operate on: the library
   * track as-is, or a remote DTO pinned on demand (like from ND browsing
   * just works). Null when the subject has no library identity (ephemeral).
   * A failed pin is reported as the failure of the action that needed it.
   */
  const resolveDbTrack = async (failedTitle: string): Promise<Track | null> => {
    const current = toValue(track);
    if (isLibraryTrack(current)) return current;

    const subject = toValue(options.subject);
    if (subject?.kind !== "remote") return null;
    try {
      // Playlists and lyrics need a row, not a library member (§1).
      const pinned = await ensurePinned(subject, { pinned: 0 });
      await invalidateLibraryData(queryClient);
      return pinned;
    }
    catch (error) {
      reportError(error, { title: failedTitle, scope: "Tracks" });
      return null;
    }
  };

  const toggleLike = async () => {
    const current = await resolveDbTrack(t("track.likeToggleFailed"));
    if (!current) return;
    options.onTrackChange?.(await toggleTrackLike(current));
  };

  const showDetails = () => {
    const current = toValue(track);
    if (!isLibraryTrack(current)) return;

    rightPanelStore.openTrackInfo({ track: current }, {
      scope: { type: "route", routeKey: route.fullPath },
      depth: 1,
    });
  };

  const showLyrics = () => {
    rightPanelStore.openLyrics({ depth: 1 });
  };

  const attachLyricsToTrack = async () => {
    const current = await resolveDbTrack(t("player.lyricsAttachFailed"));
    if (!current) return;
    const next = await attachTrackLyrics(current);
    if (next) options.onTrackChange?.(next);
  };

  const addToPlaylist = async (playlistId: PlaylistId) => {
    const current = await resolveDbTrack(t("playlist.addTrackFailed"));
    if (!current) return;
    try {
      await addTrackToPlaylistAndSync(queryClient, playlistId, current);
    }
    catch (error) {
      reportError(error, { title: t("playlist.addTrackFailed"), scope: "Tracks" });
    }
  };

  // One toast per kind: a second removal replaces the first one's undo
  // instead of stacking a toast per removed track.
  const offerUndo = (id: string, title: string, restore: () => Promise<void>, restoreFailedTitle: string) => {
    toaster.add({
      id,
      title,
      color: "success",
      actions: [{
        label: t("common.undo"),
        onClick: () => {
          restore().catch((error: unknown) => {
            reportError(error, { title: restoreFailedTitle, scope: "Tracks" });
          });
        },
      }],
    });
  };

  const removeFromQueue = () => {
    const queueItemId = toValue(options.queueItemId);
    if (!queueItemId) return;
    queueStore.removeFromQueue(queueItemId)
      .catch(error => getLogger().error(`[Queue] Removing a queue item failed: ${formatError(error)}`));
  };

  const removeFromPlaylist = async () => {
    const current = toValue(track);
    const playlistId = toValue(options.playlistId);
    if (!isLibraryTrack(current) || !playlistId) return;
    try {
      const { restore } = await removeTrackFromPlaylistWithUndo(queryClient, playlistId, current.id);
      offerUndo("playlist-track-removed", t("playlist.trackRemoved"), restore, t("playlist.restoreTrackFailed"));
    }
    catch (error) {
      reportError(error, { title: t("playlist.removeTrackFailed"), scope: "Tracks" });
    }
  };

  const removeFromHistory = async () => {
    const current = toValue(track);
    if (!isLibraryTrack(current)) return;
    try {
      const restore = await statsService.removeFromHistory(current.id);
      offerUndo("history-track-removed", t("track.removedFromHistory"), restore, t("track.restoreHistoryFailed"));
    }
    catch (error) {
      reportError(error, { title: t("track.removeFromHistoryFailed"), scope: "Tracks" });
    }
  };

  const goToArtist = (artistId: ArtistId) => {
    router.push(routeLocation.artist(artistId)).catch(error => getLogger().error(`[Tracks] Navigation to the artist page failed: ${formatError(error)}`));
    options.onNavigate?.();
  };

  const goToAlbum = () => {
    const current = toValue(track);
    if (!isLibraryTrack(current)) return;
    router.push(routeLocation.album(current.albumId)).catch(error => getLogger().error(`[Tracks] Navigation to the album page failed: ${formatError(error)}`));
    options.onNavigate?.();
  };

  /**
   * Picks the file the "Save as…" export reads from: the track's own local
   * file, or its downloaded local copy. Remote tracks without a copy have
   * nothing to export — storagePath is never read blindly.
   */
  const resolveExportPath = async (current: Track): Promise<string | null> => {
    if (trackHasLocalFile(current)) return current.storagePath;

    const copy = await getLocalCopy(current.id);
    return copy?.storagePath ?? null;
  };

  const exportFile = async () => {
    const current = toValue(track);
    if (!isLibraryTrack(current)) return;

    const sourcePath = await resolveExportPath(current);
    if (!sourcePath) return;

    const fallbackExt = sourcePath.split(".").pop()?.toLowerCase() ?? "mp3";
    const fileName = fileNameFromPath(sourcePath);

    try {
      const fileBlob = await (async () => {
        if (platformCaps.hasFs && hasNativeSupport(storageService)) {
          const isAbsolutePath = /^(?:[a-zA-Z]:[\\/]|\/)/.test(sourcePath);

          if (isAbsolutePath) {
            return new Blob([valueOrThrow(await storageService.readFile(sourcePath))]);
          }
        }

        return valueOrThrow(await storageService.getFile(sourcePath));
      })();

      if (platformCaps.hasFs) {
        const targetPath = await save({
          defaultPath: fileName,
          filters: [{
            name: "Audio",
            extensions: [fallbackExt],
          }],
        });

        if (!targetPath) return;

        await writeFile(targetPath, new Uint8Array(await fileBlob.arrayBuffer()));
        toaster.add({ title: t("track.exported"), color: "success" });
        return;
      }

      const objectUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      toaster.add({ title: t("track.exported"), color: "success" });
    }
    catch (error) {
      reportError(error, { title: t("track.exportFailed"), scope: "Tracks" });
    }
  };

  const downloadsStore = useDownloadsStore();

  /**
   * What a download acts on: the subject itself, or for a playing stream the
   * catalog track its URL names. Null when nothing can be pinned.
   */
  const downloadTarget = (): Exclude<TrackMenuSubject, { kind: "ephemeral" }> | null => {
    const current = toValue(track);
    const subject = toValue(options.subject)
      ?? (isLibraryTrack(current) ? { kind: "library" as const, track: current } : null);
    if (subject?.kind !== "ephemeral") return subject;
    const dto = ephemeralRemoteDto(subject.track);
    return dto ? { kind: "remote", dto } : null;
  };

  /** The id downloads key on: the library row id or the remote DTO id. */
  const subjectTrackId = (): TrackId | null => {
    const target = downloadTarget();
    if (!target) return null;
    return target.kind === "remote" ? target.dto.id : target.track.id;
  };

  const downloadOffline = async () => {
    const target = downloadTarget();
    if (!target) return;
    try {
      await downloadSubject(target);
    }
    catch (error) {
      reportError(error, {
        title: t("downloads.enqueueFailed"),
        scope: "Downloads",
        retry: () => {
          downloadOffline().catch(() => undefined);
        },
      });
    }
  };

  const cancelOfflineDownload = async () => {
    const trackId = subjectTrackId();
    const job = trackId ? downloadsStore.byTrackId[trackId] : undefined;
    if (job) await cancelTrackDownload(job.jobId);
  };

  const removeDownload = async () => {
    const trackId = subjectTrackId();
    if (!trackId) return;
    try {
      await removeLocalCopy(trackId);
    }
    catch (error) {
      reportError(error, { title: t("track.removeDownloadFailed"), scope: "Downloads" });
    }
  };

  const addToLibrary = async () => {
    try {
      const subject = toValue(options.subject);
      if (subject?.kind === "remote") {
        await ensurePinned(subject);
      }
      else {
        const current = toValue(track);
        if (!isLibraryTrack(current) || !isRemoteTrack(current)) return;
        await promoteTrackToLibrary(current.id);
      }
      await invalidateLibraryData(queryClient);
      toaster.add({ title: t("track.addedToLibrary"), color: "success" });
    }
    catch (error) {
      reportError(error, { title: t("track.pinFailed"), scope: "Tracks" });
    }
  };

  const removeFromLibrary = async () => {
    const current = toValue(track);
    if (!isLibraryTrack(current) || !isRemoteTrack(current)) return;
    try {
      await removeTrackFromLibrary(current.id);
      await invalidateLibraryData(queryClient);
      toaster.add({ title: t("track.removedFromLibrary"), color: "success" });
    }
    catch (error) {
      reportError(error, { title: t("track.removeFromLibraryFailed"), scope: "Tracks" });
    }
  };

  /** The track's page at its source; a playing stream names its source in the proxied URL. */
  const externalUrl = (): string | null => {
    const subject = toValue(options.subject);
    const current = toValue(track);

    let id: TrackId | null = null;
    let albumId: AlbumId | undefined;
    if (subject?.kind === "ephemeral") {
      id = subject.track.source.type === "url" ? trackIdFromStreamUrl(subject.track.source.url) : null;
    }
    else if (subject?.kind === "remote") {
      id = subject.dto.id;
      albumId = subject.dto.albumId;
    }
    else if (isLibraryTrack(current)) {
      id = current.id;
      albumId = current.albumId;
    }
    if (!id) return null;

    const kind = parseTrackRef(id).kind;
    if (kind === "local") return null;
    return sources.get(kind).externalUrl?.({ id, albumId }) ?? null;
  };

  const openExternal = async () => {
    const url = externalUrl();
    if (!url) return;
    await openUrl(url);
  };

  const guarded = <A extends unknown[]>(label: string, action: (...args: A) => Promise<unknown>) =>
    (...args: A) => {
      action(...args).catch((error: unknown) => getLogger().error(`[Tracks] Action ${label} failed: ${formatError(error)}`));
    };

  return {
    play,
    playNext,
    addToQueue,
    showDetails,
    showLyrics,
    toggleLike: guarded("toggleLike", toggleLike),
    attachLyrics: guarded("attachLyrics", attachLyricsToTrack),
    addToPlaylist: guarded("addToPlaylist", addToPlaylist),
    removeFromQueue,
    removeFromPlaylist: guarded("removeFromPlaylist", removeFromPlaylist),
    removeFromHistory: guarded("removeFromHistory", removeFromHistory),
    goToArtist,
    goToAlbum,
    exportFile: guarded("exportFile", exportFile),
    downloadOffline: guarded("downloadOffline", downloadOffline),
    cancelOfflineDownload: guarded("cancelOfflineDownload", cancelOfflineDownload),
    removeDownload: guarded("removeDownload", removeDownload),
    addToLibrary: guarded("addToLibrary", addToLibrary),
    removeFromLibrary: guarded("removeFromLibrary", removeFromLibrary),
    openExternal: guarded("openExternal", openExternal),
  };
};
