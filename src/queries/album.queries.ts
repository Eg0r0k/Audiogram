import type { AlbumEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { AlbumId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import {
  removeAlbumCaches,
  removeTracksFromCaches,
  syncAlbumCaches,
  updateCoverCache,
} from "./cache";
import { unwrapResult, unique } from "./shared";
import type { AlbumPageData, PaginatedTracksResult } from "./types";

const PAGE_SIZE = 50;

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

export async function getAlbumTracksPaginated(
  albumId: AlbumId,
  offset: number,
  limit = PAGE_SIZE,
): Promise<PaginatedTracksResult> {
  const [rawTracks, countResult] = await Promise.all([
    unwrapResult(albumRepository.findTracksPaginated(albumId, offset, limit)),
    unwrapResult(albumRepository.countTracksByAlbumId(albumId)),
  ]);

  const album = await getAlbumByIdOrThrow(albumId);

  const allArtistIds = unique(rawTracks.flatMap(t => t.artistIds));
  const allArtists = allArtistIds.length > 0
    ? await unwrapResult(artistRepository.findByIds(allArtistIds))
    : [];

  const mappedTracks = mapTracks(rawTracks, allArtists, [album]);

  const total = countResult ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    tracks: mappedTracks,
    nextOffset,
    total,
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
  tracksPageInfinite: (albumId: AlbumId, pageParam: number) =>
    queryOptions({
      queryKey: [...queryKeys.albums.tracksPage(albumId), pageParam],
      queryFn: () => getAlbumTracksPaginated(albumId, pageParam),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tracks.likedPage() }),
      queryClient.invalidateQueries({
        predicate: q => q.queryKey[0] === "playlists" && q.queryKey[2] === "page",
      }),
    ]);
  }

  return nextAlbum;
}

export async function deleteAlbumAndSync(
  queryClient: QueryClient,
  albumEntity: AlbumEntity | null,
) {
  if (!albumEntity) {
    return;
  }

  const rawTracks = await unwrapResult(trackRepository.findByAlbumId(albumEntity.id));

  await unwrapResult(coverRepository.deleteAlbumCover(albumEntity.id));
  await unwrapResult(trackRepository.deleteByAlbumId(albumEntity.id));
  await unwrapResult(albumRepository.delete(albumEntity.id));

  removeAlbumCaches(queryClient, albumEntity.id, albumEntity.artistId);
  removeTracksFromCaches(queryClient, rawTracks.map(track => track.id));

  queryClient.removeQueries({ queryKey: queryKeys.albums.cover(albumEntity.id), exact: true });
}
