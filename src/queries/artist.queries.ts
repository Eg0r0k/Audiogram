import type { ArtistEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import {
  buildAlbumDocFromDb,
  buildArtistDoc,
  buildTrackDocFromDb,
} from "@/modules/search/buildDocuments";
import { removeSearchDocuments, upsertSearchDocuments } from "@/modules/search/searchIndex";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { ArtistId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import {
  removeAlbumCaches,
  removeArtistCaches,
  removeTracksFromCaches,
  syncArtistCaches,
  updateCoverCache,
} from "./cache";
import { unwrapResult, unique } from "./shared";
import type { ArtistPageData, PaginatedTracksResult, PaginatedAlbumsResult } from "./types";

export interface ArtistChanges {
  name?: string;
  bio?: string;
  coverBlob?: Blob;
  removeCover?: boolean;
}

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
  const [rawTracks, countResult, durationResult] = await Promise.all([
    unwrapResult(artistRepository.findTracksPaginated(artistId, offset, limit)),
    unwrapResult(artistRepository.countTracksByArtistId(artistId)),
    unwrapResult(trackRepository.sumDurationByArtistId(artistId)),
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
    totalDuration: durationResult ?? 0,
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

async function syncTrackArtistNames(artistId: ArtistId, nextArtistName: string) {
  const tracks = await unwrapResult(trackRepository.findByArtistId(artistId));

  if (tracks.length === 0) {
    return;
  }

  const allArtistIds = unique(tracks.flatMap(track => track.artistIds));
  const artists = await unwrapResult(artistRepository.findByIds(allArtistIds));
  const artistNameById = new Map(artists.map(artist => [artist.id, artist.name]));
  artistNameById.set(artistId, nextArtistName);

  for (const track of tracks) {
    const artistName = track.artistIds
      .map(id => artistNameById.get(id))
      .filter(Boolean)
      .join(", ") || "Unknown Artist";

    await unwrapResult(trackRepository.update(track.id, { artistName }));
  }
}

export async function updateArtistAndSync(
  queryClient: QueryClient,
  currentArtist: ArtistEntity,
  changes: ArtistChanges,
) {
  if (changes.coverBlob) {
    await unwrapResult(coverRepository.upsertArtistCover(currentArtist.id, changes.coverBlob));
    updateCoverCache(queryClient, "artist", currentArtist.id, changes.coverBlob);
  }
  else if (changes.removeCover) {
    await unwrapResult(coverRepository.deleteArtistCover(currentArtist.id));
    updateCoverCache(queryClient, "artist", currentArtist.id, null);
  }

  const updateData: Partial<ArtistEntity> = {};

  if (changes.name && changes.name !== currentArtist.name) {
    updateData.name = changes.name;
  }

  if (changes.bio !== undefined) {
    updateData.bio = changes.bio;
  }

  const nextArtist: ArtistEntity = {
    ...currentArtist,
    ...updateData,
    updatedAt: Date.now(),
  };

  if (Object.keys(updateData).length > 0) {
    await unwrapResult(artistRepository.update(currentArtist.id, updateData));

    if (updateData.name) {
      await syncTrackArtistNames(currentArtist.id, nextArtist.name);
    }

    syncArtistCaches(queryClient, nextArtist);

    const [albums, tracks] = await Promise.all([
      unwrapResult(albumRepository.findByArtistId(currentArtist.id)),
      unwrapResult(trackRepository.findByArtistId(currentArtist.id)),
    ]);

    const searchDocuments = [
      buildArtistDoc(nextArtist),
      ...await Promise.all(albums.map(album => buildAlbumDocFromDb(album))),
      ...await Promise.all(tracks.map(track => buildTrackDocFromDb(track))),
    ];

    await upsertSearchDocuments(searchDocuments);
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.artists.page(currentArtist.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.artists.tracksPage(currentArtist.id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tracks.likedPage() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tracks.likedPageInfinite() }),
    queryClient.invalidateQueries({
      predicate: query =>
        query.queryKey[0] === "tracks" && query.queryKey[1] === "index",
    }),
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

  await unwrapResult(coverRepository.deleteArtistCover(artistEntity.id));
  await unwrapResult(trackRepository.deleteByArtistId(artistEntity.id));
  await unwrapResult(artistRepository.delete(artistEntity.id));
  await removeSearchDocuments([
    `artist:${artistEntity.id}`,
    ...albums.map(album => `album:${album.id}`),
    ...rawTracks.map(track => `track:${track.id}`),
  ]);

  removeArtistCaches(queryClient, artistEntity.id);
  removeTracksFromCaches(queryClient, rawTracks.map(track => track.id));
  queryClient.removeQueries({ queryKey: queryKeys.covers.detail("artist", artistEntity.id), exact: true });
}
