import { computed, onScopeDispose, shallowRef, toValue, triggerRef, watch, type MaybeRefOrGetter, type Ref, type ShallowRef } from "vue";
import { loadTrackRelations, memberTrackScope } from "@/queries/track.queries";
import { LivePages, uniqueById } from "@/modules/tracks/lib/livePages";
import { useLiveSearchList } from "@/modules/tracks/composables/useLiveSearchList";
import type { Track } from "@/types/track";
import { DEFAULT_TRACK_SORT_KEY } from "@/types/track-sort";

const PAGE_SIZE = 50;

export const useAddTracksList = (searchQuery: Ref<string>, enabled: MaybeRefOrGetter<boolean>) => {
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const isSearching = computed(() => normalizedSearchQuery.value !== "");
  const isEnabled = computed(() => toValue(enabled));

  const search = useLiveSearchList({
    query: () => normalizedSearchQuery.value,
    sort: () => null,
    enabled: isEnabled,
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
  const searchTracks = computed(() => search.list.value?.tracks);

  const isError = computed(() => isSearching.value ? search.isError.value : pages.value.error !== undefined);

  // A switch keeps the shown rows until the next list has its first page, so the selection is not pruned by an empty flash.
  const shownTracks = computed<Track[] | undefined>(previous =>
    (isSearching.value ? searchTracks.value : liveTracks.value) ?? (isError.value ? undefined : previous),
  );

  const tracks = computed(() => shownTracks.value ?? []);
  const isLoading = computed(() => isEnabled.value && shownTracks.value === undefined && !isError.value);
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
