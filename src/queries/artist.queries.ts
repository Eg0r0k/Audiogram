import type { ArtistEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  coverRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { ArtistId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import {
  removeAlbumCaches,
  removeArtistCaches,
  removeTracksFromCaches,
  syncArtistCaches,
} from "./cache";
import { unwrapResult } from "./shared";
import type { ArtistPageData } from "./types";

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

  return {
    artist,
    albums,
    tracks: mapTracks(rawTracks, [artist], albums),
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
  pageData: ArtistPageData | null,
) {
  if (!pageData) {
    return;
  }

  const { artist, albums } = pageData;
  const rawTracks = await unwrapResult(trackRepository.findByArtistId(artist.id));

  for (const album of albums) {
    await unwrapResult(coverRepository.deleteAlbumCover(album.id));
    await unwrapResult(albumRepository.delete(album.id));
    removeAlbumCaches(queryClient, album.id, artist.id);
    queryClient.removeQueries({ queryKey: queryKeys.albums.cover(album.id), exact: true });
  }

  await unwrapResult(trackRepository.deleteByArtistId(artist.id));
  await unwrapResult(artistRepository.delete(artist.id));

  removeArtistCaches(queryClient, artist.id);
  removeTracksFromCaches(queryClient, rawTracks.map(track => track.id));
}
