import { computed, type Ref } from "vue";
import { useInfiniteQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { formatTotalDuration } from "@/lib/format/time";
import type { LikedData } from "@/modules/media-hero/types";
import { queryKeys } from "@/queries/query-keys";
import { getLikedTracksPaginated } from "@/queries/track.queries";
import type { TrackSortKey } from "@/modules/tracks/types";

export function useLikedTracksPage(sortKey: Ref<TrackSortKey | null>) {
  const { t } = useI18n();

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
    queryKey: computed(() => queryKeys.tracks.likedPageInfinite(sortKey.value)),
    queryFn: ({ pageParam = 0 }) => getLikedTracksPaginated(pageParam, undefined, sortKey.value),
    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextOffset,
    placeholderData: previousData => previousData,
  });

  const tracks = computed(() =>
    infiniteData.value?.pages.flatMap(page => page.tracks) ?? [],
  );

  const totalCount = computed(
    () => infiniteData.value?.pages[0]?.total ?? 0,
  );

  const totalDuration = computed(() => {
    const seconds = infiniteData.value?.pages[0]?.totalDuration ?? 0;
    return formatTotalDuration(seconds, t);
  });

  const likedData = computed<LikedData>(() => ({
    type: "liked",
    title: t("common.favorite"),
    image: "/img/liked-fallback.svg",
    trackCount: totalCount.value,
    duration: totalDuration.value,
  }));

  return {
    tracks,
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
