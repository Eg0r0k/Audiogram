import {
  albumRepository,
  artistRepository,
  folderRepository,
  playlistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import { coverCache } from "@/modules/covers/lib/cover-cache";
import type { QueryClient } from "@tanstack/vue-query";
import type { AlbumId, ArtistId } from "@/types/ids";
import { rebuildCounters } from "./track.queries";
import type { LibrarySummaryData } from "./types";

// Shadow rows (pinned = 0) from ND/YT browsing stay out through the pinned index. The liked count is
// read apart (readCounters): inside this querier every like would re-read the four tables.
export const readLibrarySummary = async (): Promise<LibrarySummaryData> => {
  const [artists, albums, playlists, folders] = await Promise.all([
    artistRepository.findPinned(),
    albumRepository.findPinned(),
    playlistRepository.findAll(),
    folderRepository.findAll(),
  ]);

  return { artists, albums, playlists, folders };
};

// Per-item, for the delete dialog: the summary used to count every album
// and artist up front, one IndexedDB read each, for this one number.
export const getLibraryItemTrackCount = async (type: "album" | "artist", id: AlbumId | ArtistId): Promise<number> => {
  if (type === "album") return trackRepository.inAlbum(id as AlbumId).members().count();
  return trackRepository.byArtist(id as ArtistId).members().count();
};

// After a bulk change to the local library (import, pin, rescan).
export const invalidateLibraryData = (): void => {
  coverCache.invalidateAll();
};

const WIPED_ROOTS = [
  queryKeys.source.all(),
  queryKeys.youtube.all(),
  queryKeys.stats.all(),
];

/**
 * After a full database wipe. Reset, not removed: removeQueries leaves a
 * mounted observer holding the old rows, reset blanks it and re-reads. Remote
 * catalog answers go too and are re-read from their source on the next mount.
 */
export const clearLibraryData = async (queryClient: QueryClient): Promise<void> => {
  await Promise.all(WIPED_ROOTS.map(queryKey => queryClient.resetQueries({ queryKey })));
  coverCache.invalidateAll();
  await rebuildCounters();
};
