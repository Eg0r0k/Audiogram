import type { SearchEntityType, SearchResultItem } from "@/services/search/types";

export interface GroupedResults {
  topResults: SearchResultItem[];
  groups: Record<SearchEntityType, SearchResultItem[]>;
}

export function createEmptyGroups(): Record<SearchEntityType, SearchResultItem[]> {
  return {
    track: [],
    artist: [],
    album: [],
    playlist: [],
  };
}

export function createEmptyResults(): GroupedResults {
  return { topResults: [], groups: createEmptyGroups() };
}
