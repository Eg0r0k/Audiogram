import type {
  AlbumEntity,
  ArtistEntity,
  PlaylistEntity,
  SidebarFolderEntity,
} from "@/db/entities";
import type { TrackIndexKey } from "@/db/repositories/track.scope";
import type { Track } from "@/types/track";
import type { SearchMatch } from "@/services/search/types";

export interface LibrarySummaryData {
  artists: ArtistEntity[];
  albums: AlbumEntity[];
  playlists: PlaylistEntity[];
  folders: SidebarFolderEntity[];
  likedCount: number;
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
  /** Where an index-paged list resumes, null once it has ended; an id-sliced list pages by `nextOffset` instead. */
  last?: TrackIndexKey | null;
  total: number;
  /** Seconds across every match; only a search inside a collection knows it up front. */
  totalDuration?: number;
  /** Why each track of this page matched, keyed by track id; a search page only. */
  matches?: Record<string, SearchMatch>;
}

// The index resumes after a key and a search at an offset; null starts either.
export type TrackPageParam = TrackIndexKey | number | null;

export interface PaginatedAlbumsResult {
  albums: AlbumEntity[];
  nextOffset: number | null;
  total: number;
}

export interface PaginatedPlaylistTracksResult {
  tracks: Track[];
  nextOffset: number | null;
  total: number;
  totalDuration?: number;
}
