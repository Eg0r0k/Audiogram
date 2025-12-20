import type { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

export type DragItemType = "track" | "album" | "artist" | "playlist";

export interface DragItem {
  type: DragItemType;
  id: TrackId | AlbumId | ArtistId | PlaylistId;
  title: string;
  subtitle?: string;
  image?: string;
  // Для множественного выбора
  count?: number;
}

export type DropTargetType
  = | "playlist"
    | "queue"
    | "folder"
    | "library"
    | "sidebar-playlist";

export interface DropTarget {
  type: DropTargetType;
  id?: string;
  label: string;
  accepts: DragItemType[];
}

export interface DragState {
  isDragging: boolean;
  item: DragItem | null;
  position: { x: number; y: number };
  activeDropZone: string | null;
}
