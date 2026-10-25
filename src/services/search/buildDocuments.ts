import { db } from "@/db";
import type { AlbumEntity, ArtistEntity, PinnedFlag, PlaylistEntity, TrackEntity } from "@/db/entities";
import { fileNameFromPath } from "@/lib/files/path";
import { indexById } from "@/lib/math";
import type { SearchDocument, SearchEntityType } from "./types";

const FILE_EXTENSION_REGEX = /\.[^./\\]+$/u;

export const documentId = (type: SearchEntityType, entityId: string): string => `${type}:${entityId}`;

export const isLibraryMember = (row: { pinned: PinnedFlag }): boolean => row.pinned !== 0;

const fileNameOf = (storagePath: string | undefined): string | undefined => {
  if (!storagePath) return undefined;
  const base = fileNameFromPath(storagePath);
  return base ? base.replace(FILE_EXTENSION_REGEX, "") : undefined;
};

export function buildArtistDoc(artist: ArtistEntity): SearchDocument {
  return {
    id: documentId("artist", artist.id),
    type: "artist",
    title: artist.name,
    entityId: artist.id,
  };
}

export function buildAlbumDoc(
  album: AlbumEntity,
  artistMap: Map<string, ArtistEntity>,
): SearchDocument {
  return {
    id: documentId("album", album.id),
    type: "album",
    title: album.title,
    artist: artistMap.get(album.artistId)?.name,
    entityId: album.id,
    year: album.year,
  };
}

export function buildTrackDoc(
  track: TrackEntity,
  artistMap: Map<string, ArtistEntity>,
  albumMap: Map<string, AlbumEntity>,
): SearchDocument {
  const artists = track.artistIds
    .map(artistId => artistMap.get(artistId))
    .filter((artist): artist is ArtistEntity => !!artist);
  const album = albumMap.get(track.albumId);

  return {
    id: documentId("track", track.id),
    type: "track",
    title: track.title,
    artist: artists.length > 0 ? artists.map(a => a.name).join(", ") : track.artistName,
    album: album?.title ?? track.albumTitle,
    entityId: track.id,
    duration: track.duration,
    year: album?.year,
    fileName: fileNameOf(track.storagePath),
  };
}

export function buildPlaylistDoc(playlist: PlaylistEntity): SearchDocument {
  return {
    id: documentId("playlist", playlist.id),
    type: "playlist",
    title: playlist.name,
    entityId: playlist.id,
    description: playlist.description,
  };
}

export async function buildAllSearchDocuments(): Promise<SearchDocument[]> {
  const [allTracks, artists, albums, playlists] = await Promise.all([
    db.tracks.toArray(),
    db.artists.toArray(),
    db.albums.toArray(),
    db.playlists.toArray(),
  ]);

  // Maps keep every row (names may denormalize through shadow artists);
  // only library members become documents.
  const artistMap = indexById(artists);
  const albumMap = indexById(albums);
  const tracks = allTracks.filter(isLibraryMember);

  return [
    ...artists.filter(isLibraryMember).map(a => buildArtistDoc(a)),
    ...albums.filter(isLibraryMember).map(a => buildAlbumDoc(a, artistMap)),
    ...tracks.map(t => buildTrackDoc(t, artistMap, albumMap)),
    ...playlists.map(p => buildPlaylistDoc(p)),
  ];
}
