import type { LibraryItem, LibrarySortDirection, LibrarySortKey, SortOption } from "../types";

type LibraryItemCompare = (a: LibraryItem, b: LibraryItem) => number;

const keysOf = (field: SortOption) => [`${field}_asc`, `${field}_desc`] as const;

export const getLibrarySortDirection = (
  sortKey: LibrarySortKey | null,
  field: SortOption,
): LibrarySortDirection | null => {
  const [asc, desc] = keysOf(field);
  if (sortKey === asc) return "asc";
  if (sortKey === desc) return "desc";
  return null;
};

export const getNextLibrarySortKey = (
  current: LibrarySortKey | null,
  field: SortOption,
): LibrarySortKey | null => {
  const [asc, desc] = keysOf(field);

  if (current !== asc && current !== desc) {
    return asc;
  }

  return current === asc ? desc : null;
};

const byAddedAt: LibraryItemCompare = (a, b) => a.addedAt - b.addedAt;
const byUpdatedAt: LibraryItemCompare = (a, b) => (a.updatedAt ?? a.addedAt) - (b.updatedAt ?? b.addedAt);
const byTitle: LibraryItemCompare = (a, b) => a.title.localeCompare(b.title);
const byAuthor: LibraryItemCompare = (a, b) => (a.artistName ?? a.title).localeCompare(b.artistName ?? b.title);

const reversed = (compare: LibraryItemCompare): LibraryItemCompare => (left, right) => compare(right, left);

const COMPARATORS: Record<LibrarySortKey, LibraryItemCompare> = {
  recent_asc: byAddedAt,
  recent_desc: reversed(byAddedAt),
  updated_asc: byUpdatedAt,
  updated_desc: reversed(byUpdatedAt),
  alphabetical_asc: byTitle,
  alphabetical_desc: reversed(byTitle),
  author_asc: byAuthor,
  author_desc: reversed(byAuthor),
};

export const compareLibraryItems = (sortKey: LibrarySortKey | null): LibraryItemCompare =>
  COMPARATORS[sortKey ?? "recent_desc"];
