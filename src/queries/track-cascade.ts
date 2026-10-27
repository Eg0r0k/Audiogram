import type { PlaylistEntity, TrackEntity } from "@/db/entities";
import type { Scope } from "@/db/unit-of-work";
import { syncSearchIndex } from "@/services/search/searchIndex";
import { cleanupAfterTrackRemoval } from "@/services/library-gc";
import type { TrackId } from "@/types/ids";

//
// Deleting a container (album, artist, playlist) can take its tracks with it.
// The cascade is the same wherever it is triggered from, so it lives here:
// rows die inside the caller's transaction, everything outside the database
// (the search index) is synced strictly after the commit.
//

/** Transaction scope a track purge needs; pass to `unitOfWork.run`. */
export const TRACK_CASCADE_TABLES = ["tracks", "counters", "albums", "artists", "playlists", "covers"] as const;

export type TrackCascadeScope = Scope<(typeof TRACK_CASCADE_TABLES)[number]>;

/** A playlist that lost track references, plus which ones it lost. */
export interface PlaylistTrackRemoval {
  next: PlaylistEntity;
  removedIds: TrackId[];
}

/**
 * Deletes the track rows and everything that points at them. Runs INSIDE an
 * open transaction scoped to `TRACK_CASCADE_TABLES`; `syncAfterTrackPurge`
 * follows the commit.
 */
export const purgeTracksInTx = async (
  uow: TrackCascadeScope,
  tracks: readonly TrackEntity[],
  now: number,
): Promise<PlaylistTrackRemoval[]> => {
  if (tracks.length === 0) return [];

  const trackIds = tracks.map(track => track.id);
  const trackIdSet = new Set(trackIds);

  // Playlists are read inside the tx and written back as partial updates,
  // so a rename racing the delete survives.
  const playlists = await uow.playlists.findAll();
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
    await uow.playlists.updateMany(removals.map(({ next }) => ({
      key: next.id,
      changes: { trackIds: next.trackIds, updatedAt: next.updatedAt },
    })));
  }
  await uow.tracks.deleteMany(trackIds);
  // The album dies with its last track, the artist with their last album.
  await cleanupAfterTrackRemoval([...tracks]);

  return removals;
};

export const syncAfterTrackPurge = async (trackIds: readonly TrackId[]) => {
  if (trackIds.length === 0) return;

  await syncSearchIndex({ tracks: trackIds });
};
