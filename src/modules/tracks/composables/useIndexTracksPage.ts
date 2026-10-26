import { computed, onScopeDispose, shallowRef, triggerRef, watch, type Ref, type ShallowRef } from "vue";
import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/queries/query-keys";
import { loadTrackRelations, memberTrackScope, searchTracksPaginated, trackQueries } from "@/queries/track.queries";
import type { PaginatedTracksResult, TrackPageParam } from "@/queries/types";
import type { TrackSortKey } from "@/modules/tracks/types";
import { LivePages, uniqueById } from "@/modules/tracks/lib/livePages";
import type { SearchMatch } from "@/services/search/types";
import type { Track } from "@/types/track";
import { DEFAULT_TRACK_SORT_KEY } from "@/types/track-sort";

const PAGE_SIZE = 50;

interface IndexList {
  tracks: Track[];
  total: number;
  matches: Record<string, SearchMatch>;
}

export const useIndexTracksPage = (sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) => {
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");
  // With a search the unsorted list is the relevance order, so null stays
  // null; without one the index has to pick an order.
  const resolvedSortKey = computed<TrackSortKey | null>(() =>
    sortKey.value ?? (isSearching.value ? null : DEFAULT_TRACK_SORT_KEY));

  const {
    data: searchData,
    isError: isSearchError,
    isFetchNextPageError: isSearchFetchNextPageError,
    error: searchError,
    refetch: refetchSearch,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.tracks.indexInfinite(resolvedSortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam }) =>
      searchTracksPaginated(normalizedSearchQuery.value, typeof pageParam === "number" ? pageParam : 0, undefined, resolvedSortKey.value),
    initialPageParam: null as TrackPageParam,
    getNextPageParam: (lastPage: PaginatedTracksResult) => lastPage.last === undefined ? lastPage.nextOffset : lastPage.last,
    enabled: isSearching,
  });

  const pages: ShallowRef<LivePages<Track>> = shallowRef(new LivePages<Track>({
    scope: memberTrackScope,
    sort: () => resolvedSortKey.value ?? DEFAULT_TRACK_SORT_KEY,
    map: loadTrackRelations,
    pageSize: PAGE_SIZE,
    onChange: () => triggerRef(pages),
  }));
  // A live count re-walks every member on each write (85 ms at 20k); the total stays on TanStack.
  const memberCount = useQuery(trackQueries.memberCount());

  const restartLive = () => {
    pages.value.reset();
    if (!isSearching.value) pages.value.start();
  };

  watch([resolvedSortKey, isSearching], restartLive, { immediate: true });
  onScopeDispose(() => pages.value.dispose());

  const liveTracks = computed(() =>
    pages.value.isLoaded ? uniqueById(pages.value.pages.flatMap(page => page.rows)) : undefined,
  );

  const liveList = computed<IndexList | undefined>(() => {
    const tracks = liveTracks.value;
    const total = memberCount.data.value;
    return tracks && total !== undefined ? { tracks, total, matches: {} } : undefined;
  });

  // Matches arrive with the pages they describe, so the highlight changes in
  // the same render as the rows and never on a keystroke of its own.
  const searchList = computed<IndexList | undefined>(() => {
    const data = searchData.value;
    if (!data) return undefined;
    const [first] = data.pages;
    return {
      tracks: data.pages.flatMap(page => page.tracks),
      total: first.total,
      matches: Object.fromEntries(data.pages.flatMap(page => Object.entries(page.matches ?? {}))),
    };
  });

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<IndexList | undefined>(previous =>
    (isSearching.value ? searchList.value : liveList.value) ?? previous,
  );

  const tracks = computed(() => shownList.value?.tracks ?? []);
  const total = computed(() => shownList.value?.total ?? 0);
  const matches = computed<Record<string, SearchMatch>>(() => shownList.value?.matches ?? {});

  // TanStack reports "no error" as null; the live pages as undefined.
  const liveError = computed(() => pages.value.error ?? memberCount.error.value ?? undefined);

  // A failed next page is shown at the end of the list it failed to extend.
  const isError = computed(() => isSearching.value
    ? isSearchError.value && !isSearchFetchNextPageError.value
    : liveError.value !== undefined);
  const isLoading = computed(() => shownList.value === undefined && !isError.value);
  const error = computed(() => isSearching.value ? searchError.value : liveError.value ?? pages.value.loadMoreError);
  const hasNextPage = computed(() => isSearching.value ? hasNextSearchPage.value : pages.value.hasMore);
  const isFetchingNextPage = computed(() => isSearching.value ? isFetchingNextSearchPage.value : pages.value.isLoadingMore);
  const isFetchNextPageError = computed(() => isSearching.value
    ? isSearchFetchNextPageError.value
    : pages.value.loadMoreError !== undefined);

  const fetchNextPage = async () => {
    if (isSearching.value) {
      await fetchNextSearchPage();
      return;
    }
    await pages.value.loadMore();
  };

  const refetch = async () => {
    if (isSearching.value) {
      await refetchSearch();
      return;
    }
    memberCount.refetch().catch(() => {});
    restartLive();
  };

  return {
    tracks,
    total,
    matches,
    resolvedSortKey,
    normalizedSearchQuery,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  };
};
