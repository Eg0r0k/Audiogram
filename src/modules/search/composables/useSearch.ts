import { computed, readonly, ref, shallowRef, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import {
  SEARCH_ENTITY_TYPES,
  createEmptyResults,
  type GroupedResults,
  type SearchFilter,
  type SearchResultItem,
} from "../types";
import {
  initSearchIndex,
  rebuildSearchIndex,
  searchDocuments,
} from "../searchIndex";

const DEBOUNCE_MS = 150;
const TOP_RESULTS_COUNT = 6;
const MAX_HISTORY_ITEMS = 6;
const SEARCH_HISTORY_KEY = "audiogram-search-history";
import { useRouter, useRoute } from "vue-router";

function loadSearchHistory(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  }
  catch {
    return [];
  }
}

function persistSearchHistory(items: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
}

const query = ref("");
const activeFilter = ref<SearchFilter>("all");
const results = shallowRef<GroupedResults>(createEmptyResults());
const isSearching = ref(false);
const recentQueries = ref<string[]>(loadSearchHistory());

let latestSearchId = 0;

function groupResults(raw: SearchResultItem[]): GroupedResults {
  const grouped = createEmptyResults();

  for (const item of raw) {
    grouped.groups[item.type]?.push(item);
  }

  grouped.topResults = raw.slice(0, TOP_RESULTS_COUNT);

  return grouped;
}

const debouncedSearch = useDebounceFn(async (q: string, filter: SearchFilter) => {
  try {
    await initSearchIndex();

    const thisId = ++latestSearchId;
    const response = await searchDocuments(q, filter, { limit: 50 });

    if (thisId !== latestSearchId) return;

    results.value = groupResults(response.results);
  }
  catch (err) {
    console.error("[Search]", err);
    results.value = createEmptyResults();
  }
  finally {
    isSearching.value = false;
  }
}, DEBOUNCE_MS);

watch([query, activeFilter], ([q, filter]) => {
  const trimmed = q.trim();

  if (!trimmed) {
    results.value = createEmptyResults();
    isSearching.value = false;
    latestSearchId++;
    return;
  }

  isSearching.value = true;
  debouncedSearch(trimmed, filter);
});

const availableFilters: { label: string; value: SearchFilter }[] = [
  { label: "all", value: "all" },
  ...SEARCH_ENTITY_TYPES.map(type => ({ label: type, value: type as SearchFilter })),
];

export function useSearch() {
  const router = useRouter();
  const route = useRoute();
  const isSearchOpen = computed(() => route.hash === "#search");
  const saveQueryToHistory = (rawQuery?: string) => {
    const trimmed = (rawQuery ?? query.value).trim();
    if (!trimmed) return;

    recentQueries.value = [trimmed, ...recentQueries.value.filter(item => item !== trimmed)]
      .slice(0, MAX_HISTORY_ITEMS);
    persistSearchHistory(recentQueries.value);
  };

  const removeHistoryItem = (value: string) => {
    recentQueries.value = recentQueries.value.filter(item => item !== value);
    persistSearchHistory(recentQueries.value);
  };

  const clearHistory = () => {
    recentQueries.value = [];
    persistSearchHistory([]);
  };

  const applyHistoryItem = (value: string) => {
    query.value = value;
  };

  const openSearch = () => {
    router.push({ hash: "#search" });
  };
  const closeSearch = () => {
    router.back();
  };

  return {
    query,
    activeFilter,
    availableFilters,
    recentQueries: readonly(recentQueries),
    results,
    isSearching: readonly(isSearching),
    isSearchOpen: readonly(isSearchOpen),
    hasQuery: computed(() => query.value.trim().length > 0),
    openSearch,
    closeSearch,

    setFilter(filter: SearchFilter) { activeFilter.value = filter; },
    saveQueryToHistory,
    removeHistoryItem,
    clearHistory,
    applyHistoryItem,

    clear() {
      query.value = "";
      activeFilter.value = "all";
    },
    async rebuildIndex() {
      await rebuildSearchIndex();
    },
  };
}
