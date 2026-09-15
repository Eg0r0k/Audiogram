import { ymAlbumId, ymArtistId, ymPlaylistId, ymTrackId } from "@/types/track-ref";
import type {
  SourceAlbumDTO,
  SourceArtistDTO,
  SourceArtistRef,
  SourcePlaylistDTO,
  SourceTrackDTO,
} from "@/types/source-dto";
import type { YmAlbum, YmArtist, YmPlaylist, YmTrack } from "./api/types";

//
// Yandex shapes → normalized DTOs. Cover refs stay the raw `%%` URIs; the
// media server route substitutes the size and adds the scheme.
//

/** The album a track is mapped under, when the caller already knows it. */
export interface YmAlbumContext {
  id: number | string;
  title: string;
  coverUri?: string;
}

const coverRefOf = (uri: string | undefined): string | undefined => uri || undefined;

const withVersion = (title: string, version: string | undefined): string =>
  (version ? `${title} (${version})` : title);

/** A credited artist without an id (or with Yandex's placeholder 0) has no page. */
const artistIdOf = (artist: YmArtist) =>
  (artist.id !== undefined && String(artist.id) !== "0" ? ymArtistId(artist.id) : undefined);

export const mapYmArtistRef = (artist: YmArtist): SourceArtistRef => {
  const id = artistIdOf(artist);
  return id ? { id, name: artist.name } : { name: artist.name };
};

/**
 * A locked track (region, takedown) plays nothing. Whether the rest plays
 * whole or as a 30-second preview is not knowable from the catalog: the
 * account's Plus flag is false for family members who do get whole tracks,
 * so only `download-info` (asked when the track plays) says.
 */
export const ymAvailability = (track: YmTrack): SourceTrackDTO["availability"] =>
  (track.available === false ? "unavailable" : "full");

export const mapYmTrack = (
  track: YmTrack,
  album: YmAlbumContext | undefined = track.albums?.[0],
): SourceTrackDTO => {
  const artists = (track.artists ?? []).map(mapYmArtistRef);
  const position = track.albums?.[0]?.trackPosition;
  const coverRef = coverRefOf(track.coverUri) ?? coverRefOf(album?.coverUri);
  return {
    id: ymTrackId(track.id),
    title: withVersion(track.title, track.version),
    artistName: artists.map(artist => artist.name).join(", ") || undefined,
    artists: artists.length > 0 ? artists : undefined,
    artistIds: artists.flatMap(artist => (artist.id ? [artist.id] : [])),
    albumId: album ? ymAlbumId(album.id) : undefined,
    albumTitle: album?.title,
    duration: track.durationMs !== undefined ? Math.round(track.durationMs / 1000) : undefined,
    trackNo: position?.index,
    discNo: position?.volume,
    coverRef,
    format: { codec: "mp3" },
    availability: ymAvailability(track),
  };
};

export const mapYmAlbum = (album: YmAlbum): SourceAlbumDTO => {
  const artists = (album.artists ?? []).map(mapYmArtistRef);
  return {
    id: ymAlbumId(album.id),
    title: withVersion(album.title, album.version),
    artistId: artists.find(artist => artist.id)?.id,
    artistName: artists.map(artist => artist.name).join(", ") || undefined,
    year: album.year,
    coverRef: coverRefOf(album.coverUri),
    trackCount: album.trackCount,
  };
};

/** Null for a credited-only name: an artist without an id has no page to open. */
export const mapYmArtist = (artist: YmArtist): SourceArtistDTO | null => {
  const id = artistIdOf(artist);
  if (!id) return null;
  return {
    id,
    name: artist.name,
    albumCount: artist.counts?.directAlbums,
    coverRef: coverRefOf(artist.cover?.uri),
  };
};

const playlistCover = (playlist: YmPlaylist): string | undefined =>
  coverRefOf(playlist.cover?.uri) ?? coverRefOf(playlist.cover?.itemsUri?.[0]);

/** A playlist is addressed by owner + kind; the owner may sit on either field. */
export const ymPlaylistOwnerUid = (playlist: YmPlaylist): number | undefined =>
  playlist.uid ?? playlist.owner?.uid;

export const mapYmPlaylist = (playlist: YmPlaylist): SourcePlaylistDTO => ({
  id: ymPlaylistId(ymPlaylistOwnerUid(playlist) ?? 0, playlist.kind),
  name: playlist.title,
  trackCount: playlist.trackCount,
  coverRef: playlistCover(playlist),
});

/**
 * `/albums/{id}/with-tracks` lists discs in order without positions; the
 * position is the place in the list. The album itself supplies the cover
 * and title the track rows show.
 */
export const flattenAlbumTracks = (album: YmAlbum): SourceTrackDTO[] => {
  const albumContext: YmAlbumContext = { id: album.id, title: album.title, coverUri: album.coverUri };
  return (album.volumes ?? []).flatMap((volume, discIndex) =>
    volume.map((track, trackIndex) => ({
      ...mapYmTrack(track, albumContext),
      discNo: discIndex + 1,
      trackNo: trackIndex + 1,
    })),
  );
};

/** The playable rows of a playlist; entries without a track body are skipped. */
export const playlistTracks = (playlist: YmPlaylist): SourceTrackDTO[] =>
  (playlist.tracks ?? []).flatMap(entry => (entry.track ? [mapYmTrack(entry.track)] : []));
