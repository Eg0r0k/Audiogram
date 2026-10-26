import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { queryKeys } from "@/queries/query-keys";
import { getAllTracksPaginated, searchTracksPaginated } from "@/queries/track.queries";
import type { PaginatedTracksResult, TrackPageParam } from "@/queries/types";
import type { TrackSortKey } from "@/modules/tracks/types";
import type { SearchMatch } from "@/services/search/types";
import { DEFAULT_TRACK_SORT_KEY } from "@/types/track-sort";

export function useIndexTracksPage(sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) {
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  // With a search the unsorted list is the relevance order, so null stays
  // null; without one the index has to pick an order.
  const resolvedSortKey = computed<TrackSortKey | null>(() =>
    sortKey.value ?? (normalizedSearchQuery.value ? null : DEFAULT_TRACK_SORT_KEY));

  const queryState = useInfiniteQuery({
    queryKey: computed(() => queryKeys.tracks.indexInfinite(resolvedSortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam }) => {
      if (normalizedSearchQuery.value) {
        return searchTracksPaginated(normalizedSearchQuery.value, typeof pageParam === "number" ? pageParam : 0, undefined, resolvedSortKey.value);
      }
      return getAllTracksPaginated(typeof pageParam === "number" ? null : pageParam, undefined, resolvedSortKey.value);
    },
    initialPageParam: null as TrackPageParam,
    getNextPageParam: (lastPage: PaginatedTracksResult) => lastPage.last === undefined ? lastPage.nextOffset : lastPage.last,
    placeholderData: previousData => previousData,
  });

  const tracks = computed(() => queryState.data.value?.pages.flatMap(page => page.tracks) ?? []);
  const total = computed(() => queryState.data.value?.pages[0]?.total ?? 0);
  // Arrives with the pages it describes, so the highlight changes in the same
  // render as the rows and never on a keystroke of its own.
  const matches = computed<Record<string, SearchMatch>>(() =>
    Object.assign({}, ...(queryState.data.value?.pages.map(page => page.matches) ?? [])));
  // A failed next page is shown at the end of the list it failed to extend.
  const isError = computed(() => queryState.isError.value && !queryState.isFetchNextPageError.value);

  return {
    ...queryState,
    isError,
    resolvedSortKey,
    normalizedSearchQuery,
    tracks,
    total,
    matches,
  };
}
