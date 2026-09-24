import { useInfiniteQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { queryKeys } from "@/queries/query-keys";
import { getTracksPaginated } from "@/queries/track.queries";
import type { TrackSortKey } from "@/modules/tracks/types";
import { DEFAULT_TRACK_SORT_KEY } from "@/types/track-sort";

export function useIndexTracksPage(sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) {
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  // With a search the unsorted list is the relevance order, so null stays
  // null; without one the index has to pick an order.
  const resolvedSortKey = computed<TrackSortKey | null>(() =>
    sortKey.value ?? (normalizedSearchQuery.value ? null : DEFAULT_TRACK_SORT_KEY));

  const queryState = useInfiniteQuery({
    queryKey: computed(() => queryKeys.tracks.indexInfinite(resolvedSortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam = 0 }) =>
      getTracksPaginated(pageParam, normalizedSearchQuery.value, undefined, resolvedSortKey.value),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    placeholderData: previousData => previousData,
  });

  const tracks = computed(() => queryState.data.value?.pages.flatMap(page => page.tracks) ?? []);
  const total = computed(() => queryState.data.value?.pages[0]?.total ?? 0);

  return {
    ...queryState,
    resolvedSortKey,
    normalizedSearchQuery,
    tracks,
    total,
  };
}
