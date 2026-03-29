import { db } from "@/db";
import type { SearchDocument } from "./types";
import type { AlbumEntity, ArtistEntity, PlaylistEntity, TrackEntity } from "@/db/entities";

function buildArtistDocs(artists: ArtistEntity[]): SearchDocument[] {
  return artists.map(artist => ({
    id: `artist:${artist.id}`,
    type: "artist" as const,
    title: artist.name,
    entityId: artist.id,
  }));
}

function buildAlbumDocs(
  albums: AlbumEntity[],
  artistMap: Map<string, ArtistEntity>,
): SearchDocument[] {
  return albums.map(album => ({
    id: `album:${album.id}`,
    type: "album" as const,
    title: album.title,
    artist: artistMap.get(album.artistId)?.name,
    coverPath: album.coverPath,
    entityId: album.id,
  }));
}

function buildTrackDocs(
  tracks: TrackEntity[],
  artistMap: Map<string, ArtistEntity>,
  albumMap: Map<string, AlbumEntity>,
): SearchDocument[] {
  return tracks.map(track => ({
    id: `track:${track.id}`,
    type: "track" as const,
    title: track.title,
    artist: artistMap.get(track.artistId)?.name,
    album: albumMap.get(track.albumId)?.title,
    coverPath: albumMap.get(track.albumId)?.coverPath,
    entityId: track.id,
  }));
}

function buildPlaylistDocs(playlists: PlaylistEntity[]): SearchDocument[] {
  return playlists.map(playlist => ({
    id: `playlist:${playlist.id}`,
    type: "playlist" as const,
    title: playlist.name,
    entityId: playlist.id,
  }));
}

export async function buildSearchDocuments(): Promise<SearchDocument[]> {
  const [tracks, artists, albums, playlists] = await Promise.all([
    db.tracks.toArray(),
    db.artists.toArray(),
    db.albums.toArray(),
    db.playlists.toArray(),
  ]);

  const artistMap = new Map(artists.map(a => [a.id, a]));
  const albumMap = new Map(albums.map(a => [a.id, a]));

  return [
    ...buildArtistDocs(artists),
    ...buildAlbumDocs(albums, artistMap),
    ...buildTrackDocs(tracks, artistMap, albumMap),
    ...buildPlaylistDocs(playlists),
  ];
}

export async function buildTrackDocument(track: TrackEntity): Promise<SearchDocument> {
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
    coverPath: album?.coverPath,
    entityId: track.id,
  };
}
