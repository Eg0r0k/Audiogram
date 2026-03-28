import type { PlaylistEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  playlistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { Track } from "@/modules/player/types";
import type { PlaylistId } from "@/types/ids";
import { PlaylistId as createPlaylistId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import {
  removePlaylistCaches,
  syncPlaylistCaches,
  syncPlaylistTrackAddition,
  syncPlaylistTrackRemoval,
  updateCoverCache,
} from "./cache";
import { unique, unwrapResult } from "./shared";
import type { PlaylistPageData } from "./types";

export interface PlaylistChanges {
  name?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

export async function getPlaylists() {
  return unwrapResult(playlistRepository.findAll());
}

export async function getPlaylistByIdOrThrow(playlistId: PlaylistId) {
  const playlist = await unwrapResult(playlistRepository.findById(playlistId));

  if (!playlist) {
    throw new Error("Playlist not found");
  }

  return playlist;
}

export async function getPlaylistPageData(
  playlistId: PlaylistId,
): Promise<PlaylistPageData> {
  const playlist = await getPlaylistByIdOrThrow(playlistId);

  if (playlist.trackIds.length === 0) {
    return {
      playlist,
      tracks: [],
    };
  }

  const rawTracks = await unwrapResult(trackRepository.findByIds(playlist.trackIds));
  const artistIds = unique(rawTracks.map(track => track.artistId));
  const albumIds = unique(rawTracks.map(track => track.albumId));

  const [artists, albums] = await Promise.all([
    unwrapResult(artistRepository.findByIds(artistIds)),
    unwrapResult(albumRepository.findByIds(albumIds)),
  ]);

  const trackMap = new Map(rawTracks.map(track => [track.id, track]));
  const orderedTracks = playlist.trackIds.flatMap((trackId) => {
    const track = trackMap.get(trackId);
    return track ? [track] : [];
  });

  return {
    playlist,
    tracks: mapTracks(orderedTracks, artists, albums),
  };
}

export const playlistQueries = {
  all: () =>
    queryOptions({
      queryKey: queryKeys.playlists.all(),
      queryFn: getPlaylists,
    }),
  detail: (playlistId: PlaylistId) =>
    queryOptions({
      queryKey: queryKeys.playlists.detail(playlistId),
      queryFn: () => getPlaylistByIdOrThrow(playlistId),
    }),
  page: (playlistId: PlaylistId) =>
    queryOptions({
      queryKey: queryKeys.playlists.page(playlistId),
      queryFn: () => getPlaylistPageData(playlistId),
    }),
} as const;

export async function createPlaylistAndSync(queryClient: QueryClient) {
  const now = Date.now();
  const playlist: PlaylistEntity = {
    id: createPlaylistId(crypto.randomUUID()),
    name: "New playlist",
    trackIds: [],
    addedAt: now,
    updatedAt: now,
  };

  await unwrapResult(playlistRepository.create(playlist));
  syncPlaylistCaches(queryClient, playlist);

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
    await unwrapResult(coverRepository.upsertPlaylistCover(
      currentPlaylist.id,
      changes.coverBlob,
    ));
    updateCoverCache(queryClient, "playlist", currentPlaylist.id, changes.coverBlob);
  }
  else if (changes.removeCover) {
    await unwrapResult(coverRepository.deletePlaylistCover(currentPlaylist.id));
    updateCoverCache(queryClient, "playlist", currentPlaylist.id, null);
  }

  const updateData: Partial<PlaylistEntity> = {};

  if (changes.name && changes.name !== currentPlaylist.name) {
    updateData.name = changes.name;
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

    await unwrapResult(playlistRepository.update(currentPlaylist.id, updateData));
    syncPlaylistCaches(queryClient, nextPlaylist);
    didUpdatePlaylist = true;
  }

  if (didUpdatePlaylist) {
    queryClient.setQueryData(queryKeys.playlists.page(currentPlaylist.id), (data: PlaylistPageData | undefined) =>
      data
        ? {
            ...data,
            playlist: nextPlaylist,
          }
        : data,
    );
  }

  return nextPlaylist;
}

export async function deletePlaylistAndSync(
  queryClient: QueryClient,
  currentPlaylist: PlaylistEntity | null,
) {
  if (!currentPlaylist) {
    return;
  }

  await unwrapResult(coverRepository.deletePlaylistCover(currentPlaylist.id));
  await unwrapResult(playlistRepository.delete(currentPlaylist.id));

  removePlaylistCaches(queryClient, currentPlaylist.id);
  queryClient.removeQueries({ queryKey: queryKeys.playlists.cover(currentPlaylist.id), exact: true });
}

export async function removeTrackFromPlaylistAndSync(
  queryClient: QueryClient,
  playlistId: PlaylistId,
  trackId: string,
) {
  const playlist = await getPlaylistByIdOrThrow(playlistId);

  await unwrapResult(playlistRepository.removeTrack(playlistId, trackId as never));

  const nextPlaylist: PlaylistEntity = {
    ...playlist,
    trackIds: playlist.trackIds.filter(id => id !== trackId),
    updatedAt: Date.now(),
  };

  syncPlaylistCaches(queryClient, nextPlaylist);
  syncPlaylistTrackRemoval(queryClient, playlistId, trackId);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(playlistId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.page(playlistId) }),
  ]);

  return nextPlaylist;
}

export async function addTrackToPlaylistAndSync(
  queryClient: QueryClient,
  playlistId: PlaylistId,
  track: Track,
) {
  const playlist = await getPlaylistByIdOrThrow(playlistId);

  await unwrapResult(playlistRepository.addTrack(playlistId, track.id));

  const nextPlaylist: PlaylistEntity = {
    ...playlist,
    trackIds: playlist.trackIds.includes(track.id)
      ? playlist.trackIds
      : [...playlist.trackIds, track.id],
    updatedAt: Date.now(),
  };

  syncPlaylistCaches(queryClient, nextPlaylist);
  syncPlaylistTrackAddition(queryClient, playlistId, track);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.detail(playlistId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.page(playlistId) }),
  ]);

  return nextPlaylist;
}
