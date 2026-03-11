import { AlbumId, ArtistId, PlaylistId, TagId, TrackId } from "@/types/ids";
export enum TrackSource {
  LOCAL_INTERNAL = "local_internal", // (OPFS / AppData)
  LOCAL_EXTERNAL = "local_external", // (Tauri only)
  REMOTE_HLS = "remote_hls", // Stream
}

export enum TrackState {
  READY,
  BROKEN,
}

export interface AudioFormat {
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  lossless?: boolean;
  channels?: number;
}

export interface TagEntity {
  id: TagId;
  name: string;
}

export interface ArtistEntity {
  id: ArtistId;
  name: string;
  bio?: string;
  addedAt: number;
  updatedAt: number;
}

export interface AlbumEntity {
  id: AlbumId;
  title: string;
  artistId: ArtistId;
  year?: number;
  coverPath?: string;
  addedAt: number;
  updatedAt: number;

}

export interface PlaylistEntity {
  id: PlaylistId;
  name: string;
  description?: string;
  coverPath?: string;
  trackIds: TrackId[];
  addedAt: number;
  updatedAt: number;

}

export interface TrackEntity {
  id: TrackId;
  title: string;

  artistId: ArtistId;
  albumId: AlbumId;
  tagIds: TagId[];

  source: TrackSource;
  storagePath: string;
  state: TrackState;

  duration: number;
  format: AudioFormat;

  trackNo?: number;
  diskNo?: number;

  isLiked: boolean;
  playCount: number;
  lastPlayedAt?: number;

  searchKey: string;

  addedAt: number;
}
