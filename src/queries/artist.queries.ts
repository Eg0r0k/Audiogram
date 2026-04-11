import type { ArtistEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { ArtistId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import {
  removeAlbumCaches,
  removeArtistCaches,
  removeTracksFromCaches,
  syncArtistCaches,
} from "./cache";
import { unwrapResult, unique } from "./shared";
import type { ArtistPageData, PaginatedTracksResult, PaginatedAlbumsResult } from "./types";

const PAGE_SIZE = 50;

export async function getArtists() {
  return unwrapResult(artistRepository.findAll());
}

export async function getArtistByIdOrThrow(artistId: ArtistId) {
  const artist = await unwrapResult(artistRepository.findById(artistId));

  if (!artist) {
    throw new Error("Artist not found");
  }

  return artist;
}

export async function getArtistPageData(artistId: ArtistId): Promise<ArtistPageData> {
  const [artist, albums, rawTracks] = await Promise.all([
    getArtistByIdOrThrow(artistId),
    unwrapResult(albumRepository.findByArtistId(artistId)),
    unwrapResult(trackRepository.findByArtistId(artistId)),
  ]);

  const allArtistIds = unique(rawTracks.flatMap(t => t.artistIds));
  const allArtists = await unwrapResult(artistRepository.findByIds(allArtistIds));

  return {
    artist,
    albums,
    tracks: mapTracks(rawTracks, allArtists, albums),
  };
}

export async function getArtistTracksPaginated(
  artistId: ArtistId,
  offset: number,
  limit = PAGE_SIZE,
): Promise<PaginatedTracksResult> {
  const [rawTracks, countResult] = await Promise.all([
    unwrapResult(artistRepository.findTracksPaginated(artistId, offset, limit)),
    unwrapResult(artistRepository.countTracksByArtistId(artistId)),
  ]);

  await getArtistByIdOrThrow(artistId);
  const albumIds = unique(rawTracks.map(track => track.albumId));
  const albums = await unwrapResult(albumRepository.findByIds(albumIds));

  const allArtistIds = unique(rawTracks.flatMap(t => t.artistIds));
  const allArtists = await unwrapResult(artistRepository.findByIds(allArtistIds));

  const mappedTracks = mapTracks(rawTracks, allArtists, albums);

  const total = countResult ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    tracks: mappedTracks,
    nextOffset,
    total,
  };
}

export async function getArtistAlbumsPaginated(
  artistId: ArtistId,
  offset: number,
  limit = PAGE_SIZE,
): Promise<PaginatedAlbumsResult> {
  const [albums, countResult] = await Promise.all([
    unwrapResult(albumRepository.findByArtistIdPaginated(artistId, offset, limit)),
    unwrapResult(albumRepository.countByArtistId(artistId)),
  ]);

  const total = countResult ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    albums,
    nextOffset,
    total,
  };
}

export const artistQueries = {
  all: () =>
    queryOptions({
      queryKey: queryKeys.artists.all(),
      queryFn: getArtists,
    }),
  detail: (artistId: ArtistId) =>
    queryOptions({
      queryKey: queryKeys.artists.detail(artistId),
      queryFn: () => getArtistByIdOrThrow(artistId),
    }),
  page: (artistId: ArtistId) =>
    queryOptions({
      queryKey: queryKeys.artists.page(artistId),
      queryFn: () => getArtistPageData(artistId),
    }),
  tracksPageInfinite: (artistId: ArtistId, pageParam: number) =>
    queryOptions({
      queryKey: [...queryKeys.artists.tracksPage(artistId), pageParam],
      queryFn: () => getArtistTracksPaginated(artistId, pageParam),
    }),
  albumsPageInfinite: (artistId: ArtistId, pageParam: number) =>
    queryOptions({
      queryKey: [...queryKeys.artists.albums(artistId), pageParam],
      queryFn: () => getArtistAlbumsPaginated(artistId, pageParam),
    }),
} as const;

export async function updateArtistAndSync(
  queryClient: QueryClient,
  currentArtist: ArtistEntity,
  changes: Partial<ArtistEntity>,
) {
  const nextArtist: ArtistEntity = {
    ...currentArtist,
    ...changes,
    updatedAt: Date.now(),
  };

  await unwrapResult(artistRepository.update(currentArtist.id, changes));
  syncArtistCaches(queryClient, nextArtist);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.artists.page(currentArtist.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tracks.likedPage() }),
    queryClient.invalidateQueries({
      predicate: query =>
        query.queryKey[0] === "albums" && query.queryKey[2] === "page",
    }),
    queryClient.invalidateQueries({
      predicate: query =>
        query.queryKey[0] === "playlists" && query.queryKey[2] === "page",
    }),
  ]);

  return nextArtist;
}

export async function deleteArtistAndSync(
  queryClient: QueryClient,
  artistEntity: ArtistEntity | null,
) {
  if (!artistEntity) {
    return;
  }

  const albums = await unwrapResult(albumRepository.findByArtistId(artistEntity.id));
  const rawTracks = await unwrapResult(trackRepository.findByArtistId(artistEntity.id));

  for (const album of albums) {
    await unwrapResult(coverRepository.deleteAlbumCover(album.id));
    await unwrapResult(albumRepository.delete(album.id));
    removeAlbumCaches(queryClient, album.id, artistEntity.id);
    queryClient.removeQueries({ queryKey: queryKeys.albums.cover(album.id), exact: true });
  }

  await unwrapResult(trackRepository.deleteByArtistId(artistEntity.id));
  await unwrapResult(artistRepository.delete(artistEntity.id));

  removeArtistCaches(queryClient, artistEntity.id);
  removeTracksFromCaches(queryClient, rawTracks.map(track => track.id));
}
