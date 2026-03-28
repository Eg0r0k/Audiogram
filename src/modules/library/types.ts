import type { RouteLocationRaw } from "vue-router";

export const LIBRARY_FILTERS = ["all", "playlist", "artist", "album"] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export const SORT_OPTIONS = ["recent", "updated", "alphabetical", "author"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface LibraryItem {
  id: string;
  type: "artist" | "album" | "playlist";
  title: string;
  subtitle?: string;
  isPinned: boolean;
  addedAt: number;
  updatedAt?: number;
  artistName?: string;
  to: RouteLocationRaw;
  rounded: boolean;
}

export interface PinnedItem {
  type: "artist" | "album" | "playlist";
  id: string;
  pinnedAt: number;
}
