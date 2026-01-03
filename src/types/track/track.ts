import { AlbumId, ArtistId, TrackId } from "../ids";

export interface Track {
  id: TrackId;
  title: string;
  artist: string;
  artistId: ArtistId;
  albumId: AlbumId;
  albumName: string;
  url: string;
  cover: string;
  duration: number;
  isLiked: boolean;

}

export interface LocalTrack {
  id: string;
  title: string;
  artist: string;
  cover?: string;
  duration?: number;
  file?: File;
  url?: string;
}

export type PlayerTrack = Track | LocalTrack;
