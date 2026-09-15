export type TrackSortKey
  = | "date_added_desc"
    | "date_added_asc"
    | "title_asc"
    | "title_desc"
    | "artist_asc"
    | "artist_desc"
    | "album_asc"
    | "album_desc"
    | "duration_asc"
    | "duration_desc"
    | "plays_desc";

/** The index order when no sort is chosen and no search narrows the list. */
export const DEFAULT_TRACK_SORT_KEY: TrackSortKey = "date_added_desc";

export type TrackSortField = "title" | "duration" | "playCount" | "artistName" | "albumTitle" | "addedAt";

/** The track row field a sort key orders by; a Dexie index of the same name backs each one. */
export const trackSortField = (sortKey: TrackSortKey): TrackSortField => {
  switch (sortKey) {
    case "title_asc": case "title_desc": return "title";
    case "duration_asc": case "duration_desc": return "duration";
    case "plays_desc": return "playCount";
    case "artist_asc": case "artist_desc": return "artistName";
    case "album_asc": case "album_desc": return "albumTitle";
    case "date_added_asc": case "date_added_desc": return "addedAt";
  }
};

export const isDescendingSort = (sortKey: TrackSortKey): boolean => sortKey.endsWith("_desc");
