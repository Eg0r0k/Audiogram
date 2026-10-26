import { computed, onScopeDispose, shallowRef, triggerRef, watch, type Ref, type ShallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { formatTotalDuration } from "@/lib/format/time";
import type { LikedData } from "@/types/media-data";
import type { Track } from "@/types/track";
import { likedTrackScope, loadTrackRelations, readCounters } from "@/queries/track.queries";
import type { TrackSortKey } from "@/modules/tracks/types";
import { LivePages, uniqueById } from "@/modules/tracks/lib/livePages";
import { useLiveSearchList } from "@/modules/tracks/composables/useLiveSearchList";
import { useLiveQuery } from "@/composables/useLiveQuery";

const PAGE_SIZE = 50;

interface LikedList {
  tracks: Track[];
  count: number;
  seconds: number;
}

export const useLikedTracksPage = (sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) => {
  const { t } = useI18n();
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");

  const search = useLiveSearchList({
    query: () => normalizedSearchQuery.value,
    sort: () => sortKey.value,
    within: () => likedTrackScope().ids(),
  });

  const pages: ShallowRef<LivePages<Track>> = shallowRef(new LivePages<Track>({
    scope: likedTrackScope,
    sort: () => sortKey.value ?? undefined,
    map: loadTrackRelations,
    pageSize: PAGE_SIZE,
    onChange: () => triggerRef(pages),
  }));
  // The counter row, not a live count or duration sum: those walk every liked row (34 and 114 ms at 5k likes) on each like.
  const counters = useLiveQuery(readCounters, () => []);
  const likedCount = computed(() => counters.data.value?.liked.count);
  const likedSeconds = computed(() => counters.data.value?.liked.seconds);

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
    const seconds = likedSeconds.value;
    return tracks && count !== undefined && seconds !== undefined ? { tracks, count, seconds } : undefined;
  });

  // A filtered list reports the matches' own count and duration.
  const searchList = computed<LikedList | undefined>(() => {
    const found = search.list.value;
    if (!found) return undefined;
    return { tracks: found.tracks, count: found.total, seconds: found.totalDuration };
  });

  // A sort or search switch keeps the shown list until the next one has its first page.
  const shownList = computed<LikedList | undefined>(previous =>
    (isSearching.value ? searchList.value : liveList.value) ?? previous,
  );

  const tracks = computed(() => shownList.value?.tracks ?? []);

  const liveError = computed(() => pages.value.error ?? counters.error.value);

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
    counters.refetch();
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
