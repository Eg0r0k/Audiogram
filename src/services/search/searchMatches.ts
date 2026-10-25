import type { SearchMatch, SearchResultItem } from "./types";

/** Each hit's match keyed by entity id, for rows rendered from hydrated entities. */
export const matchesByEntity = (results: readonly SearchResultItem[]): Record<string, SearchMatch> => {
  const matches: Record<string, SearchMatch> = {};
  for (const item of results) {
    if (item.matched) matches[item.entityId] = item.matched;
  }
  return matches;
};
