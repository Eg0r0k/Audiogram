import { computed, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { TrackEntity } from "@/db/entities";
import { useLiveQuery } from "@/composables/useLiveQuery";
import { loadTrackRelations } from "@/queries/track.queries";
import type { Track } from "@/types/track";

const PAGE_SIZE = 50;

export interface LiveTrackListOptions {
  read: (limit: number) => Promise<TrackEntity[]>;
  deps: () => unknown[];
  pageSize?: number;
  enabled?: MaybeRefOrGetter<boolean>;
}

interface LiveRows {
  tracks: Track[];
  hasMore: boolean;
}

interface Growth {
  previous: number;
  done: () => void;
}

export const useLiveTrackList = (options: LiveTrackListOptions) => {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const enabled = () => toValue(options.enabled ?? true);
  const shown = ref(pageSize);
  const rows = shallowRef<LiveRows>();
  const growth = shallowRef<Growth | null>(null);
  const failure = shallowRef<unknown>();
  const loadMoreFailure = shallowRef<unknown>();

  const settle = () => {
    const pending = growth.value;
    growth.value = null;
    pending?.done();
  };

  const restart = () => {
    settle();
    failure.value = undefined;
    loadMoreFailure.value = undefined;
    shown.value = pageSize;
  };

  // Registered before useLiveQuery, so a deps change and the reset of `shown` resubscribe once.
  watch(options.deps, restart, { flush: "sync" });
  watch(enabled, (on) => {
    if (on) return;
    rows.value = undefined;
    restart();
  }, { flush: "sync" });

  const live = useLiveQuery(
    async (): Promise<LiveRows> => {
      const limit = shown.value;
      const read = await options.read(limit + 1);
      return { tracks: await loadTrackRelations(read.slice(0, limit)), hasMore: read.length > limit };
    },
    () => [...options.deps(), shown.value],
    { enabled: options.enabled },
  );

  watch(live.data, (value) => {
    rows.value = value;
    failure.value = undefined;
    settle();
  }, { flush: "sync" });

  // Not sync: useLiveQuery ends the failed subscription after setting its error, and the rollback must subscribe after that.
  watch(live.error, (cause) => {
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

  const fetchNextPage = async () => {
    if (!enabled() || growth.value || !rows.value?.hasMore) return;
    loadMoreFailure.value = undefined;
    const previous = shown.value;
    await new Promise<void>((done) => {
      growth.value = { previous, done };
      shown.value = previous + pageSize;
    });
  };

  const tracks = computed(() => rows.value?.tracks ?? []);
  const hasNextPage = computed(() => rows.value?.hasMore ?? false);
  const isFetchingNextPage = computed(() => growth.value !== null);
  const isFetchNextPageError = computed(() => loadMoreFailure.value !== undefined);
  const isLoading = computed(() => enabled() && rows.value === undefined && failure.value === undefined);
  const isError = computed(() => failure.value !== undefined);
  const error = computed(() => failure.value ?? loadMoreFailure.value);

  return {
    tracks,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isError,
    error,
    refetch: live.refetch,
  };
};
