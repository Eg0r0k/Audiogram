import { AlbumId, ArtistId, PlaylistId, TagId, TrackId } from "@/types/ids";

export enum TrackSource {
  LOCAL_INTERNAL = "local_internal",
  LOCAL_EXTERNAL = "local_external",
  REMOTE_HLS = "remote_hls",
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
  addedAt: number;
  updatedAt: number;
}

export interface PlaylistEntity {
  id: PlaylistId;
  name: string;
  description?: string;
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
  likedAt?: number;
  playCount: number;
  lastPlayedAt?: number;
  searchKey: string;
  addedAt: number;
  fingerprint?: string;
}

export interface ListenEventEntity {
  id: string;
  trackId: TrackId;
  artistId: ArtistId;
  albumId: AlbumId;
  startedAt: number;
  secondsListened: number;
  trackDuration: number;
  completed: boolean;
  skipped: boolean;
}

export type CoverOwnerType = "album" | "playlist";

export interface CoverEntity {
  id: string;
  ownerType: CoverOwnerType;
  ownerId: string;
  blob: Blob;
  mimeType: string;
  addedAt: number;
  updatedAt: number;
}
