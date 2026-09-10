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
