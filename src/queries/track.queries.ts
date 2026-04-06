import type { TrackEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/queries/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { Track } from "@/modules/player/types";
import type { TrackId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import { syncTrackLikeCaches, syncTrackMetadataCaches } from "./cache";
import { unique, unwrapResult } from "./shared";
import type { LikedTracksPageData, PaginatedTracksResult } from "./types";

const PAGE_SIZE = 50;

async function loadTrackRelations(tracks: TrackEntity[]): Promise<Track[]> {
  if (tracks.length === 0) {
    return [];
  }

  const artistIds = unique(tracks.map(track => track.artistId));
  const albumIds = unique(tracks.map(track => track.albumId));

  const [artists, albums] = await Promise.all([
    unwrapResult(artistRepository.findByIds(artistIds)),
    unwrapResult(albumRepository.findByIds(albumIds)),
  ]);

  return mapTracks(tracks, artists, albums);
}

export async function getLikedTracks() {
  return unwrapResult(trackRepository.findLiked());
}

export async function getLikedTracksPageData(): Promise<LikedTracksPageData> {
  const tracks = await getLikedTracks();
  const mappedTracks = await loadTrackRelations(tracks);

  return {
    tracks: mappedTracks,
  };
}

export async function getLikedTracksPaginated(
  offset: number,
  limit = PAGE_SIZE,
): Promise<PaginatedTracksResult> {
  const [tracks, countResult] = await Promise.all([
    unwrapResult(trackRepository.findLikedPaginated(offset, limit)),
    unwrapResult(trackRepository.countLiked()),
  ]);

  const mappedTracks = await loadTrackRelations(tracks);
  const total = countResult ?? 0;
  const nextOffset = offset + limit < total ? offset + limit : null;

  return {
    tracks: mappedTracks,
    nextOffset,
    total,
  };
}

export const trackQueries = {
  liked: () =>
    queryOptions({
      queryKey: queryKeys.tracks.liked(),
      queryFn: getLikedTracks,
    }),
  likedPage: () =>
    queryOptions({
      queryKey: queryKeys.tracks.likedPage(),
      queryFn: getLikedTracksPageData,
    }),
  likedPageInfinite: (pageParam: number) =>
    queryOptions({
      queryKey: [...queryKeys.tracks.likedPageInfinite(), pageParam],
      queryFn: () => getLikedTracksPaginated(pageParam),
    }),
} as const;

export async function toggleTrackLikeAndSync(
  queryClient: QueryClient,
  track: Track,
) {
  const currentTrack = await unwrapResult(trackRepository.findById(track.id as TrackId));

  if (!currentTrack) {
    throw new Error("Track not found");
  }

  const nextValue = !track.isLiked;
  const likedAt = nextValue ? Date.now() : undefined;

  await unwrapResult(trackRepository.setLiked(track.id, nextValue));

  const nextTrackEntity: TrackEntity = {
    ...currentTrack,
    likedAt,
  };
  const nextTrack: Track = { ...track, isLiked: nextValue };

  syncTrackLikeCaches(queryClient, nextTrackEntity, nextTrack);

  return nextTrack;
}

export async function attachTrackLyricsAndSync(
  queryClient: QueryClient,
  track: Track,
  lyricsPath: string,
) {
  const currentTrack = await unwrapResult(trackRepository.findById(track.id as TrackId));

  if (!currentTrack) {
    throw new Error("Track not found");
  }

  await unwrapResult(trackRepository.setLyricsPath(track.id, lyricsPath));

  const nextTrackEntity: TrackEntity = {
    ...currentTrack,
    lyricsPath,
  };
  const nextTrack: Track = {
    ...track,
    lyricsPath,
  };

  syncTrackMetadataCaches(queryClient, nextTrackEntity, nextTrack);

  return nextTrack;
}
