import type { TrackSortKey } from "@/modules/tracks/types";

export type TrackSortField = "title" | "album" | "dateAdded" | "duration";

const SORT_KEYS: Record<TrackSortField, readonly [TrackSortKey, TrackSortKey]> = {
  title: ["title_asc", "title_desc"],
  album: ["album_asc", "album_desc"],
  dateAdded: ["date_added_asc", "date_added_desc"],
  duration: ["duration_asc", "duration_desc"],
};

export function getNextTrackSortKey(
  current: TrackSortKey | null,
  field: TrackSortField,
): TrackSortKey | null {
  const [asc, desc] = SORT_KEYS[field];

  if (current !== asc && current !== desc) {
    return asc;
  }

  return current === asc ? desc : null;
}
