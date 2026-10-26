import type { Subscription } from "dexie";
import {
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef,
} from "vue";
import { liveRead } from "@/db/liveRead";

export interface UseLiveQueryOptions {
  enabled?: MaybeRefOrGetter<boolean>;
}

export interface UseLiveQueryResult<T> {
  data: Readonly<ShallowRef<T | undefined>>;
  isLoading: Readonly<Ref<boolean>>;
  isStale: Readonly<Ref<boolean>>;
  error: Readonly<ShallowRef<unknown>>;
  refetch: () => void;
}

const sameDeps = (next: readonly unknown[], prev: readonly unknown[]) =>
  next.length === prev.length && next.every((value, index) => Object.is(value, prev[index]));

// Queriers are read-only and never run inside unitOfWork.run: liveQuery would join that transaction.
export const useLiveQuery = <T>(
  querier: () => Promise<T> | T,
  deps: () => unknown[],
  options: UseLiveQueryOptions = {},
): UseLiveQueryResult<T> => {
  const data = shallowRef<T>();
  const isLoading = ref(true);
  const isStale = ref(false);
  const error = shallowRef<unknown>();
  const enabled = () => toValue(options.enabled ?? true);
  let subscription: Subscription | undefined;

  const unsubscribe = () => {
    subscription?.unsubscribe();
    subscription = undefined;
  };

  const subscribe = () => {
    unsubscribe();
    // An async querier keeps Dexie's zone across its awaits, and a sync throw reaches error.
    subscription = liveRead(async () => querier()).subscribe({
      next: (value) => {
        data.value = value;
        error.value = undefined;
        isLoading.value = false;
        isStale.value = false;
      },
      // Dexie keeps the subscription open after a throw and may or may not run again; end it here.
      error: (cause: unknown) => {
        error.value = cause;
        unsubscribe();
      },
    });
  };

  watch(
    () => ({ on: enabled(), keys: deps() }),
    (next, prev) => {
      const depsChanged = prev !== undefined && !sameDeps(next.keys, prev.keys);
      if (prev !== undefined && !depsChanged && next.on === prev.on) return;
      if (depsChanged) isStale.value = true;
      if (next.on) subscribe();
      else unsubscribe();
    },
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(unsubscribe);

  const refetch = () => {
    if (enabled()) subscribe();
  };

  return { data, isLoading, isStale, error, refetch };
};
