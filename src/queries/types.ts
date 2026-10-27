import type {
  AlbumEntity,
  ArtistEntity,
  PlaylistEntity,
  SidebarFolderEntity,
} from "@/db/entities";
import type { Track } from "@/types/track";

export interface LibrarySummaryData {
  artists: ArtistEntity[];
  albums: AlbumEntity[];
  playlists: PlaylistEntity[];
  folders: SidebarFolderEntity[];
}

export interface ArtistPageData {
  artist: ArtistEntity;
  albums: AlbumEntity[];
  tracks: Track[];
}

export interface AlbumPageData {
  album: AlbumEntity;
  artist: ArtistEntity;
  tracks: Track[];
}

export interface PlaylistPageData {
  playlist: PlaylistEntity;
  tracks: Track[];
}

export interface LikedTracksPageData {
  tracks: Track[];
}

export interface PaginatedTracksResult {
  tracks: Track[];
  nextOffset: number | null;
  total: number;
  /** Seconds across every match; only a search inside a collection knows it up front. */
  totalDuration?: number;
}
