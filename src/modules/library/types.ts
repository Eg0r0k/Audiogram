import type { RouteLocationRaw } from "vue-router";

export const LIBRARY_FILTERS = ["all", "playlist", "artist", "album"] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export const SORT_OPTIONS = ["recent", "updated", "alphabetical", "author"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export type LibraryItemType = "artist" | "album" | "playlist" | "liked" | "allMedia";
export type PinnableLibraryItemType = "artist" | "album" | "playlist";

export interface LibraryItem {
  id: string;
  type: LibraryItemType;
  title: string;
  subtitle?: string;
  image?: string;
  isPinned: boolean;
  isSystem?: boolean;
  addedAt: number;
  updatedAt?: number;
  artistName?: string;
  to: RouteLocationRaw;
  rounded: boolean;
  trackCount?: number;
}

export interface PinnedItem {
  type: PinnableLibraryItemType;
  id: string;
  pinnedAt: number;
}
