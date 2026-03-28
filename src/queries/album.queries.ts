import type { AlbumEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { AlbumId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import {
  removeAlbumCaches,
  removeTracksFromCaches,
  syncAlbumCaches,
  updateCoverCache,
} from "./cache";
import { unwrapResult } from "./shared";
import type { AlbumPageData } from "./types";

export interface AlbumChanges {
  title?: string;
  description?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

export async function getAlbums() {
  return unwrapResult(albumRepository.findAll());
}

export async function getAlbumByIdOrThrow(albumId: AlbumId) {
  const album = await unwrapResult(albumRepository.findById(albumId));

  if (!album) {
    throw new Error("Album not found");
  }

  return album;
}

export async function getAlbumPageData(albumId: AlbumId): Promise<AlbumPageData> {
  const [album, rawTracks] = await Promise.all([
    getAlbumByIdOrThrow(albumId),
    unwrapResult(trackRepository.findByAlbumId(albumId)),
  ]);

  const artist = await unwrapResult(artistRepository.findById(album.artistId));

  if (!artist) {
    throw new Error("Artist not found");
  }

  return {
    album,
    artist,
    tracks: mapTracks(rawTracks, [artist], [album]),
  };
}

export const albumQueries = {
  all: () =>
    queryOptions({
      queryKey: queryKeys.albums.all(),
      queryFn: getAlbums,
    }),
  detail: (albumId: AlbumId) =>
    queryOptions({
      queryKey: queryKeys.albums.detail(albumId),
      queryFn: () => getAlbumByIdOrThrow(albumId),
    }),
  page: (albumId: AlbumId) =>
    queryOptions({
      queryKey: queryKeys.albums.page(albumId),
      queryFn: () => getAlbumPageData(albumId),
    }),
} as const;

export async function updateAlbumAndSync(
  queryClient: QueryClient,
  currentAlbum: AlbumEntity,
  changes: AlbumChanges,
) {
  let nextAlbum = currentAlbum;
  let didUpdateAlbum = false;

  if (changes.coverBlob) {
    await unwrapResult(coverRepository.upsertAlbumCover(currentAlbum.id, changes.coverBlob));
    updateCoverCache(queryClient, "album", currentAlbum.id, changes.coverBlob);
  }
  else if (changes.removeCover) {
    await unwrapResult(coverRepository.deleteAlbumCover(currentAlbum.id));
    updateCoverCache(queryClient, "album", currentAlbum.id, null);
  }

  if (changes.title && changes.title !== currentAlbum.title) {
    nextAlbum = {
      ...currentAlbum,
      title: changes.title,
      updatedAt: Date.now(),
    };

    await unwrapResult(albumRepository.update(currentAlbum.id, {
      title: changes.title,
    }));

    syncAlbumCaches(queryClient, nextAlbum);
    didUpdateAlbum = true;
  }

  if (didUpdateAlbum) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.page(currentAlbum.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.artists.page(currentAlbum.artistId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks.likedPage() }),
      queryClient.invalidateQueries({
        predicate: query =>
          query.queryKey[0] === "playlists" && query.queryKey[2] === "page",
      }),
    ]);
  }

  return nextAlbum;
}

export async function deleteAlbumAndSync(
  queryClient: QueryClient,
  pageData: AlbumPageData | null,
) {
  if (!pageData) {
    return;
  }

  const { album, artist } = pageData;
  const rawTracks = await unwrapResult(trackRepository.findByAlbumId(album.id));

  await unwrapResult(coverRepository.deleteAlbumCover(album.id));
  await unwrapResult(trackRepository.deleteByAlbumId(album.id));
  await unwrapResult(albumRepository.delete(album.id));

  removeAlbumCaches(queryClient, album.id, artist.id);
  removeTracksFromCaches(queryClient, rawTracks.map(track => track.id));

  queryClient.removeQueries({ queryKey: queryKeys.albums.cover(album.id), exact: true });
}
