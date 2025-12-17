import { PlaylistId } from "@/types/ids";

export type TrackContext = "default" | "queue" | "playlist" | "album" | "search" | "history" | "liked" | "artist-page";

export interface ContextActions {
  play: () => void;
  playNext: () => void;
  addToQueue: () => void;
  toggleLike: () => void;
  addToPlaylist: (playlistId: PlaylistId) => void;
  removeFromQueue?: () => void;
  removeFromPlaylist?: () => void;
  removeFromHistory?: () => void;
  goToArtist: () => void;
  goToAlbum: () => void;
  download: () => void;
}
