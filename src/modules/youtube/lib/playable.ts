import type { SourceTrackDTO } from "@/modules/sources/types";
import { ytAlbumId, ytArtistId, ytTrackId } from "@/types/track-ref";
import type { YtMusicTrack, YtSearchResult } from "../types";

/**
 * Full DTO from a music-track entity (collection/artist pages): carries the
 * album and artist ids, so the row links to them and adding it to the library
 * creates their rows.
 * `fallback` fills what an album listing omits per track — the page's own
 * album id/title and cover.
 */
export function ytMusicTrackToDto(
  track: YtMusicTrack,
  fallback?: { albumId?: string | null; albumTitle?: string | null; thumbnail?: string | null },
): SourceTrackDTO {
  const albumBrowseId = track.album?.id ?? fallback?.albumId ?? undefined;
  const artistIds = track.artists
    .map(artist => artist.id)
    .filter((id): id is string => !!id)
    .map(ytArtistId);
  // Credits keep their order and their names; artistIds is the id-only
  // subset the pin cascade walks, and the two are not interchangeable.
  const artists = track.artists.map(artist => ({
    id: artist.id ? ytArtistId(artist.id) : undefined,
    name: artist.name,
  }));
  return {
    id: ytTrackId(track.id),
    title: track.title,
    artistName: track.artists.map(a => a.name).join(", ") || undefined,
    artistIds: artistIds.length > 0 ? artistIds : undefined,
    artists: artists.length > 0 ? artists : undefined,
    albumId: albumBrowseId ? ytAlbumId(albumBrowseId) : undefined,
    albumTitle: track.album?.name ?? fallback?.albumTitle ?? undefined,
    duration: track.duration ?? undefined,
    trackNo: track.trackNr ?? undefined,
    coverRef: track.thumbnail ?? fallback?.thumbnail ?? undefined,
  };
}

/**
 * A plain (non-music) video as a track DTO. Carries no album or artist ids —
 * a video has neither — so a download of one pins a bare track, which is all
 * YouTube offers about it.
 */
export function ytVideoToDto(video: YtSearchResult): SourceTrackDTO {
  return {
    id: ytTrackId(video.id),
    title: video.title,
    artistName: video.uploader ?? undefined,
    duration: video.duration ?? undefined,
    coverRef: video.thumbnail ?? undefined,
  };
}
