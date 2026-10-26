import { computed, onScopeDispose, shallowRef, triggerRef, watch, type Ref, type ShallowRef } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { loadTrackRelations, memberTrackScope, trackQueries } from "@/queries/track.queries";
import type { TrackSortKey } from "@/modules/tracks/types";
import { LivePages, uniqueById } from "@/modules/tracks/lib/livePages";
import { useLiveSearchList } from "@/modules/tracks/composables/useLiveSearchList";
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

  const search = useLiveSearchList({
    query: () => normalizedSearchQuery.value,
    sort: () => resolvedSortKey.value,
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

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<IndexList | undefined>(previous =>
    (isSearching.value ? search.list.value : liveList.value) ?? previous,
  );

  const tracks = computed(() => shownList.value?.tracks ?? []);
  const total = computed(() => shownList.value?.total ?? 0);
  const matches = computed<Record<string, SearchMatch>>(() => shownList.value?.matches ?? {});

  // TanStack reports "no error" as null; the live pages as undefined.
  const liveError = computed(() => pages.value.error ?? memberCount.error.value ?? undefined);

  // A failed next page is shown at the end of the list it failed to extend.
  const isError = computed(() => isSearching.value ? search.isError.value : liveError.value !== undefined);
  const isLoading = computed(() => shownList.value === undefined && !isError.value);
  const error = computed(() => isSearching.value ? search.error.value : liveError.value ?? pages.value.loadMoreError);
  const hasNextPage = computed(() => isSearching.value ? search.hasNextPage.value : pages.value.hasMore);
  const isFetchingNextPage = computed(() => isSearching.value ? search.isFetchingNextPage.value : pages.value.isLoadingMore);
  const isFetchNextPageError = computed(() => isSearching.value
    ? search.isFetchNextPageError.value
    : pages.value.loadMoreError !== undefined);

  const fetchNextPage = async () => {
    if (isSearching.value) {
      await search.fetchNextPage();
      return;
    }
    await pages.value.loadMore();
  };

  const refetch = () => {
    if (isSearching.value) {
      search.refetch();
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
