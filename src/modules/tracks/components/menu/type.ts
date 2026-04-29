import { ArtistId, PlaylistId } from "@/types/ids";

export type TrackContext = "default" | "current-track" | "queue" | "playlist" | "album" | "search" | "history" | "liked" | "artist";

export interface ContextActions {
  play: () => void;
  playNext: () => void;
  addToQueue: () => void;
  showDetails: () => void;
  showLyrics: () => void;
  toggleLike: () => void;
  attachLyrics: () => void;
  addToPlaylist: (playlistId: PlaylistId) => void;
  removeFromQueue?: () => void;
  removeFromPlaylist?: () => void;
  removeFromHistory?: () => void;
  goToArtist: (artistId: ArtistId) => void;
  goToAlbum: () => void;
  download: () => void;
}
