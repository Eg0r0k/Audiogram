import type { AlbumEntity, ArtistEntity, TrackEntity } from "@/db/entities";
import type { Track } from "@/modules/player/types";

export function mapTrack(
  entity: TrackEntity,
  artist: ArtistEntity | null | undefined,
  album: AlbumEntity | null | undefined,
): Track {
  return {
    id: entity.id,
    title: entity.title,
    artist: artist?.name ?? "Unknown Artist",
    artistId: entity.artistId,
    albumId: entity.albumId,
    albumName: album?.title ?? "Unknown Album",
    storagePath: entity.storagePath,
    source: entity.source,
    cover: album?.coverPath,
    duration: entity.duration,
    isLiked: entity.isLiked,
  };
}

export function mapTracks(
  entities: TrackEntity[],
  artists: ArtistEntity[],
  albums: AlbumEntity[],
): Track[] {
  const artistMap = new Map(artists.map(a => [a.id, a]));
  const albumMap = new Map(albums.map(a => [a.id, a]));
  return entities.map(e => mapTrack(e, artistMap.get(e.artistId), albumMap.get(e.albumId)));
}
