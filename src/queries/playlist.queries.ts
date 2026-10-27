import type { PlaylistEntity, TrackEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  playlistRepository,
  trackRepository,
} from "@/db/repositories";
import { DbError } from "@/db/errors/db.errors";
import { unitOfWork } from "@/db/unit-of-work";
import { syncSearchIndex } from "@/services/search/searchIndex";
import type { TrackSortKey } from "@/modules/tracks/types";
import { mapTracks, type Track } from "@/types/track";
import type { PlaylistId, TrackId } from "@/types/ids";
import { PlaylistId as createPlaylistId } from "@/types/ids";
import { removeCoverCache, updateCoverCache } from "@/modules/covers/lib/cover-cache";
import { assertValidName } from "@/lib/limits";
import { unique } from "@/lib/math";
import {
  purgeTracksInTx,
  syncAfterTrackPurge,
  TRACK_CASCADE_TABLES,
} from "./track-cascade";
import type { PlaylistPageData } from "./types";
import { deleteOwnedFiles } from "@/services/track-files";

/** The playlist row under an id, or null — a miss is an answer, not an error. */
export async function getPlaylistLibraryRow(playlistId: PlaylistId): Promise<PlaylistEntity | null> {
  return (await playlistRepository.findById(playlistId)) ?? null;
}

export interface PlaylistChanges {
  name?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

export async function getPlaylists() {
  return playlistRepository.findAll();
}

export async function getPlaylistByIdOrThrow(playlistId: PlaylistId) {
  const playlist = await playlistRepository.findById(playlistId);

  if (!playlist) {
    throw new DbError("NOT_FOUND", "Playlist not found");
  }

  return playlist;
}

export async function getPlaylistPageData(
  playlistId: PlaylistId,
  sortKey: TrackSortKey | null = null,
): Promise<PlaylistPageData> {
  const playlist = await getPlaylistByIdOrThrow(playlistId);

  if (playlist.trackIds.length === 0) {
    return { playlist, tracks: [] };
  }

  let rawTracks: TrackEntity[];
  if (sortKey) {
    rawTracks = await trackRepository.withIds(playlist.trackIds).rows({ sort: sortKey });
  }
  else {
    const unorderedTracks = await trackRepository.findByIds(playlist.trackIds);
    const trackMap = new Map(unorderedTracks.map(track => [track.id, track]));
    rawTracks = playlist.trackIds.flatMap((id) => {
      const track = trackMap.get(id);
      return track ? [track] : [];
    });
  }

  const artistIds = unique(rawTracks.flatMap(track => track.artistIds));
  const albumIds = unique(rawTracks.map(track => track.albumId));

  const [artists, albums] = await Promise.all([
    artistRepository.findByIds(artistIds),
    albumRepository.findByIds(albumIds),
  ]);

  return {
    playlist,
    tracks: mapTracks(rawTracks, artists, albums),
  };
}

// An id without a row is skipped and the ids after it fill its place, so a short read still means the end.
export const readPlaylistTracks = async (
  playlistId: PlaylistId,
  sortKey: TrackSortKey | null,
  limit: number,
): Promise<TrackEntity[]> => {
  const trackIds = (await playlistRepository.findById(playlistId))?.trackIds ?? [];
  if (sortKey) return trackRepository.withIds(trackIds).rows({ sort: sortKey, limit });
  const rows: TrackEntity[] = [];
  let from = 0;
  while (rows.length < limit && from < trackIds.length) {
    const to = from + limit - rows.length;
    rows.push(...(await trackRepository.withIds(trackIds.slice(from, to)).rows()));
    from = to;
  }
  return rows;
};

export const readPlaylistTotals = async (playlistId: PlaylistId): Promise<{ count: number; seconds: number }> => {
  const trackIds = (await playlistRepository.findById(playlistId))?.trackIds ?? [];
  const seconds = trackIds.length === 0 ? 0 : await trackRepository.withIds(trackIds).sumDuration();
  return { count: trackIds.length, seconds };
};

export async function createPlaylistAndSync(name = "New playlist") {
  const now = Date.now();
  const playlist: PlaylistEntity = {
    id: createPlaylistId(crypto.randomUUID()),
    name: assertValidName(name, "playlist"),
    trackIds: [],
    addedAt: now,
    updatedAt: now,
  };

  await playlistRepository.create(playlist);
  await syncSearchIndex({ playlists: [playlist.id] });

  return playlist;
}

export async function updatePlaylistAndSync(
  currentPlaylist: PlaylistEntity,
  changes: PlaylistChanges,
) {
  let nextPlaylist = currentPlaylist;
  let didUpdatePlaylist = false;

  if (changes.coverBlob) {
    const stored = await coverRepository.upsertPlaylistCover(
      currentPlaylist.id,
      changes.coverBlob,
    );
    updateCoverCache("playlist", currentPlaylist.id, stored);
  }
  else if (changes.removeCover) {
    await coverRepository.deletePlaylistCover(currentPlaylist.id);
    updateCoverCache("playlist", currentPlaylist.id, null);
  }

  const updateData: Partial<PlaylistEntity> = {};

  if (changes.name && changes.name !== currentPlaylist.name) {
    updateData.name = assertValidName(changes.name, "playlist");
  }

  if (changes.description !== undefined) {
    updateData.description = changes.description;
  }

  if (Object.keys(updateData).length > 0) {
    nextPlaylist = {
      ...currentPlaylist,
      ...updateData,
      updatedAt: Date.now(),
    };

    await playlistRepository.update(currentPlaylist.id, updateData);
    didUpdatePlaylist = true;
  }

  if (didUpdatePlaylist) {
    await syncSearchIndex({ playlists: [currentPlaylist.id] });
  }

  return nextPlaylist;
}

/**
 * A playlist is only a list of references, so deleting one leaves its tracks
 * in the library by default. `deleteTracks` removes them from the library
 * outright — including from every other playlist that referenced them.
 */
export async function deletePlaylistAndSync(
  currentPlaylist: PlaylistEntity | null,
  options: { deleteTracks?: boolean } = {},
) {
  if (!currentPlaylist) {
    return;
  }

  const tracks = options.deleteTracks === true && currentPlaylist.trackIds.length > 0
    ? await trackRepository.findByIds(currentPlaylist.trackIds)
    : [];
  const trackIds = tracks.map(track => track.id);
  const now = Date.now();

  await unitOfWork.run(
    TRACK_CASCADE_TABLES,
    async (uow) => {
      await purgeTracksInTx(uow, tracks, now);
      await uow.covers.deletePlaylistCover(currentPlaylist.id);
      await uow.playlists.delete(currentPlaylist.id);
    },
  );
  await deleteOwnedFiles(tracks);

  await syncAfterTrackPurge(trackIds);
  await syncSearchIndex({ playlists: [currentPlaylist.id] });

  removeCoverCache("playlist", currentPlaylist.id);
}

export async function removeTrackFromPlaylistAndSync(
  playlistId: PlaylistId,
  trackId: string,
) {
  await playlistRepository.removeTrack(playlistId, trackId as never);
  // The row is read back after the write, not derived from a read before
  // it: another change to the same playlist may have landed in between.
  return getPlaylistByIdOrThrow(playlistId);
}

/**
 * Removes the track and hands back an undo that puts it back at its old
 * position in the playlist as it is by then; a track that came back some
 * other way meanwhile is not added twice.
 */
export const removeTrackFromPlaylistWithUndo = async (
  playlistId: PlaylistId,
  trackId: TrackId,
): Promise<{ restore: () => Promise<void> }> => {
  const index = (await getPlaylistByIdOrThrow(playlistId)).trackIds.indexOf(trackId);
  await removeTrackFromPlaylistAndSync(playlistId, trackId);

  const restore = async (): Promise<void> => {
    if (index === -1) return;
    await playlistRepository.insertTrack(playlistId, trackId, index);
    // insertTrack is a no-op on a deleted playlist; the read reports it.
    await getPlaylistByIdOrThrow(playlistId);
  };

  return { restore };
};

export async function addTrackToPlaylistAndSync(
  playlistId: PlaylistId,
  track: Track,
) {
  return addTracksToPlaylistAndSync(playlistId, [track]);
}

export async function addTracksToPlaylistAndSync(
  playlistId: PlaylistId,
  tracks: Track[],
) {
  await playlistRepository.addTracks(playlistId, tracks.map(track => track.id));
  return getPlaylistByIdOrThrow(playlistId);
}
