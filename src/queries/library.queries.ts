import {
  albumRepository,
  artistRepository,
  folderRepository,
  playlistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import { coverCache } from "@/modules/covers/lib/cover-cache";
import { markRecommenderContextDirty } from "@/modules/recommendations/service/recommender-context.service";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import { settleLibraryReads } from "./cache";
import { unwrapResult } from "./shared";
import type { LibrarySummaryData } from "./types";

export const getLibrarySummary = async (): Promise<LibrarySummaryData> => {
  // Playing from ND/YT browsing must not grow the library — shadow rows
  // (pinned = 0) are excluded by the pinned index.
  const [artists, albums, playlists, folders, likedCount] = await Promise.all([
    unwrapResult(artistRepository.findPinned()),
    unwrapResult(albumRepository.findPinned()),
    unwrapResult(playlistRepository.findAll()),
    unwrapResult(folderRepository.findAll()),
    unwrapResult(trackRepository.countLiked()),
  ]);

  const [albumTrackCounts, artistTrackCounts] = await Promise.all([
    unwrapResult(trackRepository.countByAlbumIds(albums.map(a => a.id))),
    unwrapResult(trackRepository.countByArtistIds(artists.map(a => a.id))),
  ]);

  const albumsWithCounts = albums.map(album => ({
    ...album,
    trackCount: albumTrackCounts.get(album.id) ?? 0,
  }));

  const artistsWithCounts = artists.map(artist => ({
    ...artist,
    trackCount: artistTrackCounts.get(artist.id) ?? 0,
  }));

  return {
    artists: artistsWithCounts,
    albums: albumsWithCounts,
    playlists,
    folders,
    likedCount,
  };
};

export const libraryQueries = {
  summary: () =>
    queryOptions({
      queryKey: queryKeys.library.summary(),
      queryFn: getLibrarySummary,
    }),
} as const;

/**
 * After a bulk change to the local library (import, pin, rescan). Unlike the
 * per-mutation registry in cache.ts this waits for the mounted lists to
 * re-read, so a caller can chain on the refreshed rows.
 */
export const invalidateLibraryData = async (queryClient: QueryClient): Promise<void> => {
  markRecommenderContextDirty();
  // A first-load read has no data to cancel; invalidation would join it and
  // take its pre-write answer for the refetch.
  await settleLibraryReads(queryClient);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.library.summary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.artists.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.albums.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tracks.all() }),
  ]);
  coverCache.invalidateAll();
};

/**
 * After a full database wipe. Every Dexie-backed answer is wrong now, so the
 * whole cache goes — reset, not removed: removeQueries leaves a mounted
 * observer holding the old rows, reset blanks it and re-reads the empty
 * database. Remote catalog answers go with it and are re-read from their
 * source on the next mount.
 */
export const clearLibraryData = async (queryClient: QueryClient): Promise<void> => {
  await queryClient.resetQueries();
  coverCache.invalidateAll();
};
