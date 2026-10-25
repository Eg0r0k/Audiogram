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
import { queryKeys } from "@/queries/query-keys";
import { syncSearchIndex } from "@/services/search/searchIndex";
import type { TrackSortKey } from "@/modules/tracks/types";
import { mapTracks, type Track } from "@/types/track";
import type { PlaylistId, TrackId } from "@/types/ids";
import { PlaylistId as createPlaylistId } from "@/types/ids";
import { queryOptions, skipToken, type QueryClient } from "@tanstack/vue-query";
import {
  invalidateForPlaylistMutation,
  invalidateForTrackMutation,
  removePlaylistCaches,
  settleLibraryReads,
  syncPlaylistCaches,
  syncPlaylistTracksAddition,
  syncPlaylistTracksRemoval,
  updateCoverCache,
  removeCoverCache,
} from "./cache";
import { assertValidName } from "@/lib/limits";
import { sortTracks, unique } from "./shared";
import {
  purgeTracksInTx,
  syncAfterTrackPurge,
  TRACK_CASCADE_TABLES,
} from "./track-cascade";
import type { PlaylistPageData, PaginatedPlaylistTracksResult } from "./types";
import { deleteOwnedFiles } from "@/services/track-files";

const PAGE_SIZE = 50;

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
    rawTracks = await trackRepository.findSortedByIds(playlist.trackIds, sortKey);
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

export async function getPlaylistTracksPaginated(
  playlistId: PlaylistId,
  offset: number,
  limit = PAGE_SIZE,
  sortKey: TrackSortKey | null = null,
): Promise<PaginatedPlaylistTracksResult> {
  const playlist = await getPlaylistByIdOrThrow(playlistId);
  const total = playlist.trackIds.length;

  if (total === 0) {
    return { tracks: [], nextOffset: null, total };
  }

  let currentTracksPage: TrackEntity[];

  if (sortKey) {
    // A global sort genuinely needs all rows (playlists are the smallest collection).
    const allTracks = await trackRepository.findByIds(playlist.trackIds);
    const sorted = sortTracks(allTracks, sortKey);
    currentTracksPage = sorted.slice(offset, offset + limit);
  }
  else {
    const pageIds = playlist.trackIds.slice(offset, offset + limit);
    const pageTracks = await trackRepository.findByIds(pageIds);
    const trackMap = new Map(pageTracks.map(track => [track.id, track]));
    currentTracksPage = pageIds.flatMap((id) => {
      const track = trackMap.get(id);
      return track ? [track] : [];
    });
  }

  const artistIds = unique(currentTracksPage.flatMap(track => track.artistIds));
  const albumIds = unique(currentTracksPage.map(track => track.albumId));

  const [artists, albums] = await Promise.all([
    artistRepository.findByIds(artistIds),
    albumRepository.findByIds(albumIds),
  ]);

  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    tracks: mapTracks(currentTracksPage, artists, albums),
    nextOffset,
    total,
  };
}

export async function getPlaylistTotalDuration(playlistId: PlaylistId): Promise<number> {
  const playlist = await getPlaylistByIdOrThrow(playlistId);
  if (playlist.trackIds.length === 0) return 0;
  return trackRepository.sumDurationByTrackIds(playlist.trackIds);
}
export const playlistQueries = {
  all: () =>
    queryOptions({
      queryKey: queryKeys.playlists.all(),
      queryFn: getPlaylists,
    }),
  detail: (playlistId: PlaylistId, enabled = true) =>
    queryOptions({
      queryKey: queryKeys.playlists.detail(playlistId),
      queryFn: () => getPlaylistByIdOrThrow(playlistId),
      enabled,
    }),
  /**
   * The Dexie row under this id, or null when there is none. A branded
   * remote id may or may not have one — that is the question this answers —
   * so a miss is an answer, not the error `detail` raises.
   */
  libraryRow: (playlistId: PlaylistId | null) =>
    queryOptions({
      queryKey: queryKeys.playlists.libraryRow(playlistId),
      queryFn: playlistId ? () => getPlaylistLibraryRow(playlistId) : skipToken,
    }),
  totalDuration: (playlistId: PlaylistId, enabled = true) =>
    queryOptions({
      queryKey: queryKeys.playlists.totalDuration(playlistId),
      queryFn: () => getPlaylistTotalDuration(playlistId),
      enabled,
    }),
} as const;

export async function createPlaylistAndSync(queryClient: QueryClient, name = "New playlist") {
  const now = Date.now();
  const playlist: PlaylistEntity = {
    id: createPlaylistId(crypto.randomUUID()),
    name: assertValidName(name, "playlist"),
    trackIds: [],
    addedAt: now,
    updatedAt: now,
  };

  await playlistRepository.create(playlist);
  await settleLibraryReads(queryClient);
  syncPlaylistCaches(queryClient, playlist);
  await syncSearchIndex({ playlists: [playlist.id] });

  return playlist;
}

export async function updatePlaylistAndSync(
  queryClient: QueryClient,
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
    await settleLibraryReads(queryClient);
    syncPlaylistCaches(queryClient, nextPlaylist);
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
  queryClient: QueryClient,
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

  const removals = await unitOfWork.run(
    TRACK_CASCADE_TABLES,
    async (uow) => {
      const purged = await purgeTracksInTx(uow, tracks, now);
      await uow.covers.deletePlaylistCover(currentPlaylist.id);
      await uow.playlists.delete(currentPlaylist.id);
      return purged;
    },
  );
  await deleteOwnedFiles(tracks);

  await settleLibraryReads(queryClient);
  // This playlist is gone — re-syncing its caches would put it back.
  await syncAfterTrackPurge(queryClient, trackIds, removals, [currentPlaylist.id]);
  await syncSearchIndex({ playlists: [currentPlaylist.id] });

  removePlaylistCaches(queryClient, currentPlaylist.id);
  removeCoverCache("playlist", currentPlaylist.id);

  if (trackIds.length > 0) {
    // A playlist's tracks span arbitrary albums and artists, and the purge may
    // have GC'd any of them — nothing narrower than the full sweep is safe.
    invalidateForTrackMutation(queryClient, { kind: "relations" });
  }
}

export async function removeTrackFromPlaylistAndSync(
  queryClient: QueryClient,
  playlistId: PlaylistId,
  trackId: string,
) {
  await playlistRepository.removeTrack(playlistId, trackId as never);
  // The row is read back after the write, not derived from a read before
  // it: another change to the same playlist may have landed in between.
  const nextPlaylist = await getPlaylistByIdOrThrow(playlistId);
  await settleLibraryReads(queryClient);

  syncPlaylistCaches(queryClient, nextPlaylist);
  syncPlaylistTracksRemoval(queryClient, playlistId, new Set([trackId]));
  invalidateForPlaylistMutation(queryClient, { kind: "tracksChange", playlistId });

  return nextPlaylist;
}

/**
 * Removes the track and hands back an undo that puts it back at its old
 * position in the playlist as it is by then; a track that came back some
 * other way meanwhile is not added twice.
 */
export const removeTrackFromPlaylistWithUndo = async (
  queryClient: QueryClient,
  playlistId: PlaylistId,
  trackId: TrackId,
): Promise<{ restore: () => Promise<void> }> => {
  const index = (await getPlaylistByIdOrThrow(playlistId)).trackIds.indexOf(trackId);
  await removeTrackFromPlaylistAndSync(queryClient, playlistId, trackId);

  const restore = async (): Promise<void> => {
    if (index === -1) return;
    await playlistRepository.insertTrack(playlistId, trackId, index);
    const nextPlaylist = await getPlaylistByIdOrThrow(playlistId);
    await settleLibraryReads(queryClient);
    syncPlaylistCaches(queryClient, nextPlaylist);
    invalidateForPlaylistMutation(queryClient, { kind: "tracksChange", playlistId });
  };

  return { restore };
};

export async function addTrackToPlaylistAndSync(
  queryClient: QueryClient,
  playlistId: PlaylistId,
  track: Track,
) {
  return addTracksToPlaylistAndSync(queryClient, playlistId, [track]);
}

export async function addTracksToPlaylistAndSync(
  queryClient: QueryClient,
  playlistId: PlaylistId,
  tracks: Track[],
) {
  // One row write for the whole batch; the repository reports which ids
  // were actually appended so the page patch only gets those.
  const added = await playlistRepository.addTracks(playlistId, tracks.map(track => track.id));
  const nextPlaylist = await getPlaylistByIdOrThrow(playlistId);
  await settleLibraryReads(queryClient);
  const addedSet = new Set(added);

  syncPlaylistCaches(queryClient, nextPlaylist);
  syncPlaylistTracksAddition(queryClient, playlistId, tracks.filter(track => addedSet.has(track.id)));
  invalidateForPlaylistMutation(queryClient, { kind: "tracksChange", playlistId });

  return nextPlaylist;
}
