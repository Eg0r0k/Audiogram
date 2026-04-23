import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { trackQueries } from "@/queries/track.queries";
import type { TrackSortKey } from "@/modules/tracks/types";
import { TracksIndexPageData } from "@/queries/types";

export function useIndexTracksPage(sortKey: Ref<TrackSortKey | null>, searchQuery: Ref<string>) {
  const normalizedSearchQuery = computed(() => searchQuery.value.trim());
  const resolvedSortKey = computed<TrackSortKey>(() => sortKey.value ?? "date_added_desc");

  const queryState = useQuery(computed(() => ({
    ...trackQueries.index(resolvedSortKey.value, normalizedSearchQuery.value),
    placeholderData: (previousData: TracksIndexPageData | undefined) => previousData,
  })));

  const tracks = computed(() => queryState.data.value?.tracks ?? []);
  const total = computed(() => queryState.data.value?.total ?? 0);
  const totalDuration = computed(() => queryState.data.value?.totalDuration ?? 0);

  return {
    ...queryState,
    resolvedSortKey,
    normalizedSearchQuery,
    tracks,
    total,
    totalDuration,
  };
}
