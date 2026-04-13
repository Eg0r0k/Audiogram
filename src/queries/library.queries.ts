import {
  albumRepository,
  artistRepository,
  playlistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import { unwrapResult } from "./shared";
import type { LibrarySummaryData } from "./types";

export async function getLibrarySummary(): Promise<LibrarySummaryData> {
  const [artists, albums, playlists, likedTracks] = await Promise.all([
    unwrapResult(artistRepository.findAll()),
    unwrapResult(albumRepository.findAll()),
    unwrapResult(playlistRepository.findAll()),
    unwrapResult(trackRepository.findLiked()),
  ]);

  const [albumsWithCounts, artistsWithCounts] = await Promise.all([
    Promise.all(
      albums.map(async (album) => {
        const trackCountResult = await albumRepository.countTracksByAlbumId(album.id);
        return {
          ...album,
          trackCount: trackCountResult.isOk() ? trackCountResult.value : 0,
        };
      }),
    ),
    Promise.all(
      artists.map(async (artist) => {
        const trackCountResult = await artistRepository.countTracksByArtistId(artist.id);
        return {
          ...artist,
          trackCount: trackCountResult.isOk() ? trackCountResult.value : 0,
        };
      }),
    ),
  ]);

  return {
    artists: artistsWithCounts,
    albums: albumsWithCounts,
    playlists,
    likedTracks,
  };
}

export const libraryQueries = {
  summary: () =>
    queryOptions({
      queryKey: queryKeys.library.summary(),
      queryFn: getLibrarySummary,
    }),
} as const;

export async function invalidateLibrarySummary(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.library.summary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tracks.liked() }),
  ]);
}

export async function invalidateLibraryData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["library"] }),
    queryClient.invalidateQueries({ queryKey: ["artists"] }),
    queryClient.invalidateQueries({ queryKey: ["albums"] }),
    queryClient.invalidateQueries({ queryKey: ["playlists"] }),
    queryClient.invalidateQueries({ queryKey: ["tracks"] }),
    queryClient.invalidateQueries({ queryKey: ["covers"] }),
  ]);
}

export async function clearLibraryData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.removeQueries({ queryKey: ["library"] }),
    queryClient.removeQueries({ queryKey: ["artists"] }),
    queryClient.removeQueries({ queryKey: ["albums"] }),
    queryClient.removeQueries({ queryKey: ["playlists"] }),
    queryClient.removeQueries({ queryKey: ["tracks"] }),
    queryClient.removeQueries({ queryKey: ["covers"] }),
  ]);

  await invalidateLibraryData(queryClient);
}
