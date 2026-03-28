export type MediaContext = "artist-page" | "liked" | "playlist" | "album";

export interface MediaActions {
  addToQueue: () => void;
  edit: () => void;
  delete: () => void;
  share: () => void;
}
