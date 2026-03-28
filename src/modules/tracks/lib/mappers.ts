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
    duration: entity.duration,
    isLiked: !!entity.likedAt,
  };
}

export function mapTracks(
  entities: TrackEntity[],
  artists: ArtistEntity[],
  albums: AlbumEntity[],
): Track[] {
  const artistMap = new Map(artists.map(artist => [artist.id, artist]));
  const albumMap = new Map(albums.map(album => [album.id, album]));

  return entities.map(entity =>
    mapTrack(entity, artistMap.get(entity.artistId), albumMap.get(entity.albumId)),
  );
}
