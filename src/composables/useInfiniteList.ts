import { ref, shallowRef, computed } from "vue";

interface UseInfiniteListOptions<T, C = string | null> {
  fetcher: (cursor: C) => Promise<{ items: T[]; nextCursor: C }>;
  initialCursor?: C;
}

export function useInfiniteList<T, C = string | null>(
  options: UseInfiniteListOptions<T, C>,
) {
  const { fetcher, initialCursor = null as C } = options;

  const items = shallowRef<T[]>([]);
  const cursor = ref<C>(initialCursor) as { value: C };
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<Error | null>(null);
  const hasMore = ref(true);

  const isEmpty = computed(() => !loading.value && items.value.length === 0);

  const loadMore = async () => {
    if (loadingMore.value || !hasMore.value) return;

    const isInitial = items.value.length === 0;
    if (isInitial) {
      loading.value = true;
    }
    else {
      loadingMore.value = true;
    }

    error.value = null;

    try {
      const result = await fetcher(cursor.value);
      items.value = [...items.value, ...result.items];
      cursor.value = result.nextCursor;
      hasMore.value = result.nextCursor !== null;
    }
    catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    }
    finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const refresh = async () => {
    items.value = [];
    cursor.value = initialCursor;
    hasMore.value = true;
    await loadMore();
  };

  const reset = () => {
    items.value = [];
    cursor.value = initialCursor;
    hasMore.value = true;
    loading.value = false;
    loadingMore.value = false;
    error.value = null;
  };

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    isEmpty,
    loadMore,
    refresh,
    reset,
  };
}
