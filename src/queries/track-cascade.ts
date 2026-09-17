import type { PlaylistEntity, TrackEntity } from "@/db/entities";
import { db } from "@/db";
import { playlistRepository, trackRepository } from "@/db/repositories";
import { removeSearchDocuments } from "@/modules/search/service/searchIndex";
import { cleanupAfterTrackRemoval } from "@/services/library-gc";
import type { PlaylistId, TrackId } from "@/types/ids";
import type { QueryClient } from "@tanstack/vue-query";
import { removeTracksFromCaches, syncPlaylistCaches } from "./cache";
import { unwrapResult } from "./shared";

//
// Deleting a container (album, artist, playlist) can take its tracks with it.
// The cascade is the same wherever it is triggered from, so it lives here:
// rows die inside the caller's transaction, everything outside the database
// (query caches, the search index) is synced strictly after the commit.
//

/** Transaction scope a track purge needs — pass to `unitOfWork.runScoped`. */
export const trackCascadeTables = () => [
  db.tracks,
  db.albums,
  db.artists,
  db.playlists,
  db.covers,
];

/** A playlist that lost track references, plus which ones it lost. */
export interface PlaylistTrackRemoval {
  next: PlaylistEntity;
  removedIds: TrackId[];
}

/**
 * Deletes the track rows and everything that points at them. Runs INSIDE an
 * open transaction scoped to `trackCascadeTables()`; the returned playlist
 * removals are the caller's input to `syncAfterTrackPurge`.
 */
export const purgeTracksInTx = async (
  tracks: readonly TrackEntity[],
  now: number,
): Promise<PlaylistTrackRemoval[]> => {
  if (tracks.length === 0) return [];

  const trackIds = tracks.map(track => track.id);
  const trackIdSet = new Set(trackIds);

  // Playlists are read inside the tx and written back as partial updates,
  // so a rename racing the delete survives.
  const playlists = await unwrapResult(playlistRepository.findAll());
  const removals = playlists
    .filter(playlist => playlist.trackIds.some(id => trackIdSet.has(id)))
    .map(playlist => ({
      next: {
        ...playlist,
        trackIds: playlist.trackIds.filter(id => !trackIdSet.has(id)),
        updatedAt: now,
      },
      removedIds: playlist.trackIds.filter(id => trackIdSet.has(id)),
    }));

  if (removals.length > 0) {
    await unwrapResult(playlistRepository.updateMany(removals.map(({ next }) => ({
      key: next.id,
      changes: { trackIds: next.trackIds, updatedAt: next.updatedAt },
    }))));
  }
  await unwrapResult(trackRepository.deleteMany(trackIds));
  // The album dies with its last track, the artist with their last album.
  await cleanupAfterTrackRemoval([...tracks]);

  return removals;
};

/**
 * Post-commit fan-out for a purge: query caches and the search index.
 * `skipPlaylistIds` drops playlists that were deleted alongside the tracks —
 * re-syncing their caches would resurrect them. The purged rows leave every
 * paged list, the playlists' included, in one pass.
 */
export const syncAfterTrackPurge = async (
  queryClient: QueryClient,
  trackIds: readonly TrackId[],
  playlistRemovals: readonly PlaylistTrackRemoval[],
  skipPlaylistIds: readonly PlaylistId[] = [],
) => {
  const skipped = new Set(skipPlaylistIds);
  for (const { next } of playlistRemovals) {
    if (!skipped.has(next.id)) syncPlaylistCaches(queryClient, next);
  }

  if (trackIds.length === 0) return;

  removeTracksFromCaches(queryClient, trackIds);
  await removeSearchDocuments(trackIds.map(id => `track:${id}`));
};
