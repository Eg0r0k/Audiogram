import { TrackSource } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

export const REPEAT_MODES = ["off", "all", "one"] as const;
export type RepeatMode = typeof REPEAT_MODES[number];

export interface Track {
  id: TrackId;
  title: string;
  artist: string;
  artistId: ArtistId;
  albumId: AlbumId;
  albumName: string;
  storagePath: string;
  source: TrackSource;
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
  storagePath?: string;
}

export type PlayerTrack = Track | LocalTrack;
