import { computed, onScopeDispose, shallowRef, triggerRef, watch, type Ref, type ShallowRef } from "vue";
import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { formatTotalDuration } from "@/lib/format/time";
import type { TrackId } from "@/types/ids";
import type { LikedData } from "@/types/media-data";
import type { Track } from "@/types/track";
import { queryKeys } from "@/queries/query-keys";
import { libraryQueries } from "@/queries/library.queries";
import { likedTrackScope, loadTrackRelations, searchLikedTracks, trackQueries } from "@/queries/track.queries";
import type { PaginatedTracksResult, TrackPageParam } from "@/queries/types";
import type { TrackSortKey } from "@/modules/tracks/types";
import { LivePages } from "@/modules/favorite/lib/livePages";

const PAGE_SIZE = 50;

interface LikedList {
  tracks: Track[];
  count: number;
  seconds: number;
}

// A row liked between a window's upper bound and the open page's resume key lands in both.
const uniqueById = (tracks: Track[]): Track[] => {
  const seen = new Set<TrackId>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
};

export const useLikedTracksPage = (sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) => {
  const { t } = useI18n();
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");

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
    queryKey: computed(() => queryKeys.tracks.likedPageInfinite(sortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam }) =>
      searchLikedTracks(normalizedSearchQuery.value, typeof pageParam === "number" ? pageParam : 0, undefined, sortKey.value),
    initialPageParam: null as TrackPageParam,
    getNextPageParam: (lastPage: PaginatedTracksResult) => lastPage.last === undefined ? lastPage.nextOffset : lastPage.last,
    enabled: isSearching,
  });

  const pages: ShallowRef<LivePages<Track>> = shallowRef(new LivePages<Track>({
    scope: likedTrackScope,
    sort: () => sortKey.value ?? undefined,
    map: loadTrackRelations,
    pageSize: PAGE_SIZE,
    onChange: () => triggerRef(pages),
  }));
  // Totals stay on TanStack: a live count or duration sum walks every liked row (34 and 114 ms at 5k likes) on each like.
  const summary = useQuery(libraryQueries.summary());
  const likedSeconds = useQuery(trackQueries.likedTotalDuration());
  const likedCount = computed(() => summary.data.value?.likedCount);

  const restartLive = () => {
    pages.value.reset();
    if (!isSearching.value) pages.value.start();
  };

  watch([sortKey, isSearching], restartLive, { immediate: true });
  onScopeDispose(() => pages.value.dispose());

  const liveTracks = computed(() =>
    pages.value.isLoaded ? uniqueById(pages.value.pages.flatMap(page => page.rows)) : undefined,
  );

  const liveList = computed<LikedList | undefined>(() => {
    const tracks = liveTracks.value;
    const count = likedCount.value;
    const seconds = likedSeconds.data.value;
    return tracks && count !== undefined && seconds !== undefined ? { tracks, count, seconds } : undefined;
  });

  // A filtered list reports the matches' own count and duration.
  const searchList = computed<LikedList | undefined>(() => {
    const data = searchData.value;
    if (!data) return undefined;
    const [first] = data.pages;
    return {
      tracks: data.pages.flatMap(page => page.tracks),
      count: first.total,
      seconds: first.totalDuration ?? likedSeconds.data.value ?? 0,
    };
  });

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<LikedList | undefined>(previous =>
    (isSearching.value ? searchList.value : liveList.value) ?? previous,
  );

  const tracks = computed(() => shownList.value?.tracks ?? []);

  // TanStack reports "no error" as null; the live pages as undefined.
  const liveError = computed(() => pages.value.error ?? summary.error.value ?? likedSeconds.error.value ?? undefined);

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
    summary.refetch().catch(() => {});
    likedSeconds.refetch().catch(() => {});
    restartLive();
  };

  const totalDuration = computed(() => formatTotalDuration(shownList.value?.seconds ?? 0, t));

  const likedData = computed<LikedData>(() => ({
    type: "liked",
    title: t("common.favorite"),
    image: "/img/liked-fallback.svg",
    trackCount: shownList.value?.count ?? 0,
    duration: totalDuration.value,
  }));

  return {
    tracks,
    normalizedSearchQuery,
    likedData,
    totalDuration,
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
