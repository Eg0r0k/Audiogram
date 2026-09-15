import { computed, type Ref } from "vue";
import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { formatTotalDuration } from "@/lib/format/time";
import type { LikedData } from "@/types/media-data";
import { queryKeys } from "@/queries/query-keys";
import { getLikedTracksPaginated, searchLikedTracks, trackQueries } from "@/queries/track.queries";
import type { TrackSortKey } from "@/modules/tracks/types";

export function useLikedTracksPage(sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) {
  const { t } = useI18n();
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());

  const {
    data: infiniteData,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: computed(() => queryKeys.tracks.likedPageInfinite(sortKey.value, normalizedSearchQuery.value)),
    queryFn: ({ pageParam = 0 }) => normalizedSearchQuery.value
      ? searchLikedTracks(normalizedSearchQuery.value, pageParam, undefined, sortKey.value)
      : getLikedTracksPaginated(pageParam, undefined, sortKey.value),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    placeholderData: previousData => previousData,
  });

  const { data: likedTotalDurationSeconds } = useQuery(trackQueries.likedTotalDuration());

  const tracks = computed(() =>
    infiniteData.value?.pages.flatMap(page => page.tracks) ?? [],
  );

  const totalCount = computed(
    () => infiniteData.value?.pages[0]?.total ?? 0,
  );

  // A filtered list reports the matches' own duration, like their count.
  const totalDuration = computed(() =>
    formatTotalDuration(infiniteData.value?.pages[0]?.totalDuration ?? likedTotalDurationSeconds.value ?? 0, t),
  );

  const likedData = computed<LikedData>(() => ({
    type: "liked",
    title: t("common.favorite"),
    image: "/img/liked-fallback.svg",
    trackCount: totalCount.value,
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
  };
}
