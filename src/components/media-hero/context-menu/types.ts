export type MediaContext = "artist-page" | "liked" | "playlist" | "album";

export interface MediaActions {
  addPlaylistInQueue: () => void;
  changePlaylist: () => void;
  deletePlaylist: () => void;
  share: () => void;
}
