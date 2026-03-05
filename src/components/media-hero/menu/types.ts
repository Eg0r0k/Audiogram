export type MediaType = "artist" | "album" | "playlist" | "liked";

export type MediaContext = "artist-page" | "liked" | "playlist" | "album";

export interface MediaActions {
  addToQueue: () => void;
  edit: () => void;
  delete: () => void;
  share: () => void;
}

export interface BaseMediaData {
  title: string;
  image: string;
}

export interface ArtistData extends BaseMediaData {
  type: "artist";
  trackCount: number;
}

export interface AlbumData extends BaseMediaData {
  type: "album";
  artistName: string;
  year?: number;
  trackCount: number;
  duration: string;
}

export interface PlaylistData extends BaseMediaData {
  type: "playlist";
  isOwner: boolean;
  trackCount: number;
  duration: string;
}

export interface LikedData extends BaseMediaData {
  type: "liked";
  trackCount: number;
  duration: string;
}

export type MediaData = ArtistData | AlbumData | PlaylistData | LikedData;

export function isArtist(data: MediaData): data is ArtistData {
  return data.type === "artist";
}

export function isAlbum(data: MediaData): data is AlbumData {
  return data.type === "album";
}

export function isPlaylist(data: MediaData): data is PlaylistData {
  return data.type === "playlist";
}

export function isLiked(data: MediaData): data is LikedData {
  return data.type === "liked";
}
