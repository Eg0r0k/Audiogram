import { computed, onScopeDispose, shallowRef, toValue, triggerRef, watch, type MaybeRefOrGetter, type Ref, type ShallowRef } from "vue";
import { useInfiniteQuery } from "@tanstack/vue-query";
import { queryKeys } from "@/queries/query-keys";
import { loadTrackRelations, memberTrackScope, searchTracksPaginated } from "@/queries/track.queries";
import type { PaginatedTracksResult, TrackPageParam } from "@/queries/types";
import { LivePages, uniqueById } from "@/modules/tracks/lib/livePages";
import type { Track } from "@/types/track";
import { DEFAULT_TRACK_SORT_KEY } from "@/types/track-sort";

const PAGE_SIZE = 50;

export const useAddTracksList = (searchQuery: Ref<string>, enabled: MaybeRefOrGetter<boolean>) => {
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");
  const isEnabled = computed(() => toValue(enabled));

  const {
    data: searchData,
    isError: isSearchError,
    isFetchNextPageError: isSearchFetchNextPageError,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.tracks.allPaginated(normalizedSearchQuery.value)),
    queryFn: ({ pageParam }) =>
      searchTracksPaginated(normalizedSearchQuery.value, typeof pageParam === "number" ? pageParam : 0),
    initialPageParam: null as TrackPageParam,
    getNextPageParam: (lastPage: PaginatedTracksResult) => lastPage.last === undefined ? lastPage.nextOffset : lastPage.last,
    enabled: computed(() => isEnabled.value && isSearching.value),
  });

  const pages: ShallowRef<LivePages<Track>> = shallowRef(new LivePages<Track>({
    scope: memberTrackScope,
    sort: () => DEFAULT_TRACK_SORT_KEY,
    map: loadTrackRelations,
    pageSize: PAGE_SIZE,
    onChange: () => triggerRef(pages),
  }));

  watch([isEnabled, isSearching], () => {
    pages.value.reset();
    if (isEnabled.value && !isSearching.value) pages.value.start();
  }, { immediate: true });
  onScopeDispose(() => pages.value.dispose());

  const liveTracks = computed(() =>
    pages.value.isLoaded ? uniqueById(pages.value.pages.flatMap(page => page.rows)) : undefined,
  );
  const searchTracks = computed(() => searchData.value?.pages.flatMap(page => page.tracks));

  const isError = computed(() => isSearching.value
    ? isSearchError.value && !isSearchFetchNextPageError.value
    : pages.value.error !== undefined);

  // A switch keeps the shown rows until the next list has its first page, so the selection is not pruned by an empty flash.
  const shownTracks = computed<Track[] | undefined>(previous =>
    (isSearching.value ? searchTracks.value : liveTracks.value) ?? (isError.value ? undefined : previous),
  );

  const tracks = computed(() => shownTracks.value ?? []);
  const isLoading = computed(() => isEnabled.value && shownTracks.value === undefined && !isError.value);
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

  return {
    tracks,
    normalizedSearchQuery,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  };
};
