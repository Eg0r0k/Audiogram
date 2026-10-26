import { computed, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useLiveQuery } from "@/composables/useLiveQuery";
import { idsTrackScope, loadTrackRelations, searchTrackIds, type SearchedTrackIds } from "@/queries/track.queries";
import { onSearchIndexChanged } from "@/services/search/searchIndex";
import type { SearchMatch } from "@/services/search/types";
import type { TrackSortKey } from "@/modules/tracks/types";
import type { TrackId } from "@/types/ids";
import type { Track } from "@/types/track";

const PAGE_SIZE = 50;

export interface LiveSearchListOptions {
  query: () => string;
  sort: () => TrackSortKey | null;
  within?: () => Promise<readonly TrackId[]>;
  pageSize?: number;
  enabled?: MaybeRefOrGetter<boolean>;
}

export interface SearchedList {
  tracks: Track[];
  matches: Record<string, SearchMatch>;
  total: number;
  totalDuration: number;
}

interface Hits extends SearchedTrackIds {
  sort: TrackSortKey | null;
}

interface SearchedRows extends SearchedList {
  hasMore: boolean;
}

interface Growth {
  previous: number;
  done: () => void;
}

const sameIds = (next: readonly TrackId[], prev: readonly TrackId[] | undefined) =>
  prev !== undefined && next.length === prev.length && next.every((id, index) => id === prev[index]);

export const useLiveSearchList = (options: LiveSearchListOptions) => {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const active = () => toValue(options.enabled ?? true) && options.query() !== "";
  const shown = ref(pageSize);
  const within = shallowRef<readonly TrackId[]>();
  const hits = shallowRef<Hits>();
  const rows = shallowRef<SearchedRows>();
  const indexVersion = ref(0);
  const growth = shallowRef<Growth | null>(null);
  const failure = shallowRef<unknown>();
  const loadMoreFailure = shallowRef<unknown>();
  let ticket = 0;

  const settle = () => {
    const pending = growth.value;
    growth.value = null;
    pending?.done();
  };

  // Registered before the live reads, so a new query drops the old hits before anything resubscribes.
  watch([active, options.query, options.sort], () => {
    ticket++;
    settle();
    hits.value = undefined;
    rows.value = undefined;
    failure.value = undefined;
    loadMoreFailure.value = undefined;
    shown.value = pageSize;
    if (!active()) within.value = undefined;
  }, { flush: "sync" });

  const liveWithin = useLiveQuery(
    async () => (options.within ? options.within() : []),
    () => [],
    { enabled: () => active() && options.within !== undefined },
  );

  watch(liveWithin.data, (ids) => {
    if (ids && active() && !sameIds(ids, within.value)) within.value = ids;
  }, { flush: "sync" });

  watch(liveWithin.error, (cause) => {
    if (cause !== undefined) failure.value = cause;
  });

  const search = () => {
    if (!active() || (options.within && within.value === undefined)) return;
    const own = ++ticket;
    const sort = options.sort();
    searchTrackIds(options.query(), within.value, sort).then(
      (found) => {
        if (own === ticket) hits.value = { ...found, sort };
      },
      (cause: unknown) => {
        if (own === ticket) failure.value = cause;
      },
    );
  };

  onSearchIndexChanged(() => {
    if (active()) indexVersion.value++;
  });

  watch([active, options.query, options.sort, within, indexVersion], search, { immediate: true });

  const liveRows = useLiveQuery(
    async (): Promise<SearchedRows | undefined> => {
      const found = hits.value;
      if (!found) return undefined;
      const limit = shown.value;
      const read = await idsTrackScope(found.ids.slice(0, limit)).rows({ sort: found.sort ?? undefined });
      // Matches and totals ride with the rows they describe, so a highlight never changes before its row.
      return {
        tracks: await loadTrackRelations(read),
        matches: found.matches,
        total: found.total,
        totalDuration: found.totalDuration,
        hasMore: found.ids.length > limit,
      };
    },
    () => [hits.value, shown.value],
    { enabled: () => active() && hits.value !== undefined },
  );

  watch(liveRows.data, (value) => {
    if (!value) return;
    rows.value = value;
    failure.value = undefined;
    settle();
  }, { flush: "sync" });

  // Not sync: useLiveQuery ends the failed subscription after setting its error, and the rollback must subscribe after that.
  watch(liveRows.error, (cause) => {
    if (cause === undefined) return;
    const pending = growth.value;
    if (!pending) {
      failure.value = cause;
      return;
    }
    loadMoreFailure.value = cause;
    settle();
    shown.value = pending.previous;
  });

  onScopeDispose(settle);

  const hasNextPage = computed(() => rows.value?.hasMore ?? false);

  const fetchNextPage = async () => {
    if (!active() || growth.value || !hasNextPage.value) return;
    loadMoreFailure.value = undefined;
    const previous = shown.value;
    await new Promise<void>((done) => {
      growth.value = { previous, done };
      shown.value = previous + pageSize;
    });
  };

  const refetch = () => {
    failure.value = undefined;
    liveWithin.refetch();
    search();
  };

  const list = computed<SearchedList | undefined>(() => rows.value);
  const isFetchingNextPage = computed(() => growth.value !== null);
  const isFetchNextPageError = computed(() => loadMoreFailure.value !== undefined);
  const isLoading = computed(() => active() && rows.value === undefined && failure.value === undefined);
  const isError = computed(() => failure.value !== undefined);
  const error = computed(() => failure.value ?? loadMoreFailure.value);

  return {
    list,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isError,
    error,
    refetch,
  };
};
