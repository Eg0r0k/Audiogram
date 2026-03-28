import type { TrackEntity } from "@/db/entities";
import {
  albumRepository,
  artistRepository,
  trackRepository,
} from "@/db/repositories";
import { queryKeys } from "@/lib/query-keys";
import { mapTracks } from "@/modules/tracks/lib/mappers";
import type { Track } from "@/modules/player/types";
import type { TrackId } from "@/types/ids";
import { queryOptions, type QueryClient } from "@tanstack/vue-query";
import { syncTrackLikeCaches } from "./cache";
import { unique, unwrapResult } from "./shared";
import type { LikedTracksPageData } from "./types";

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
  const nextTrack: Track = {
    ...track,
    isLiked: nextValue,
  };

  syncTrackLikeCaches(queryClient, nextTrackEntity, nextTrack);

  return nextTrack;
}
