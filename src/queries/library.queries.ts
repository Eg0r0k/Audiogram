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

  return {
    artists,
    albums,
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
