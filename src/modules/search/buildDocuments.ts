import { db } from "@/db";
import type { AlbumEntity, ArtistEntity, PlaylistEntity, TrackEntity } from "@/db/entities";
import type { SearchDocument } from "./types";

export function buildArtistDoc(artist: ArtistEntity): SearchDocument {
  return {
    id: `artist:${artist.id}`,
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
    id: `album:${album.id}`,
    type: "album",
    title: album.title,
    artist: artistMap.get(album.artistId)?.name,
    entityId: album.id,
  };
}

export function buildTrackDoc(
  track: TrackEntity,
  artistMap: Map<string, ArtistEntity>,
  albumMap: Map<string, AlbumEntity>,
): SearchDocument {
  return {
    id: `track:${track.id}`,
    type: "track",
    title: track.title,
    artist: artistMap.get(track.artistId)?.name,
    album: albumMap.get(track.albumId)?.title,
    entityId: track.id,
  };
}

export function buildPlaylistDoc(playlist: PlaylistEntity): SearchDocument {
  return {
    id: `playlist:${playlist.id}`,
    type: "playlist",
    title: playlist.name,
    entityId: playlist.id,
  };
}

export async function buildTrackDocFromDb(track: TrackEntity): Promise<SearchDocument> {
  const [artist, album] = await Promise.all([
    db.artists.get(track.artistId),
    db.albums.get(track.albumId),
  ]);

  return {
    id: `track:${track.id}`,
    type: "track",
    title: track.title,
    artist: artist?.name,
    album: album?.title,
    entityId: track.id,
  };
}

export async function buildAlbumDocFromDb(album: AlbumEntity): Promise<SearchDocument> {
  const artist = await db.artists.get(album.artistId);

  return {
    id: `album:${album.id}`,
    type: "album",
    title: album.title,
    artist: artist?.name,
    entityId: album.id,
  };
}

export async function buildAllSearchDocuments(): Promise<SearchDocument[]> {
  const [tracks, artists, albums, playlists] = await Promise.all([
    db.tracks.toArray(),
    db.artists.toArray(),
    db.albums.toArray(),
    db.playlists.toArray(),
  ]);

  const artistMap = new Map(artists.map(a => [a.id, a]));
  const albumMap = new Map(albums.map(a => [a.id, a]));

  return [
    ...artists.map(a => buildArtistDoc(a)),
    ...albums.map(a => buildAlbumDoc(a, artistMap)),
    ...tracks.map(t => buildTrackDoc(t, artistMap, albumMap)),
    ...playlists.map(p => buildPlaylistDoc(p)),
  ];
}
