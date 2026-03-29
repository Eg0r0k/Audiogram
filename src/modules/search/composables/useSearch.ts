import { computed, readonly, ref, shallowRef, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import type {
  GroupedResults,
  SearchDocument,
  SearchFilter,
  SearchResultItem,
  WorkerRequest,
  WorkerResponse,
} from "../types";
import { SEARCH_ENTITY_TYPES, createEmptyResults } from "../types";
import { buildSearchDocuments } from "../buildDocuments";
import SearchWorker from "../search.worker?worker";

const DEBOUNCE_MS = 150;
const TOP_RESULTS_COUNT = 6;

// ── Worker singleton ──────────────────────────────────────────────────────────

let worker: Worker | null = null;
let requestId = 0;
let buildPromise: Promise<void> | null = null;

type SearchCallback = (results: SearchResultItem[]) => void;
const callbacks = new Map<number, SearchCallback>();

const isReady = ref(false);
const indexCount = ref(0);

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new SearchWorker();

  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;

    switch (msg.action) {
      case "ready":
        isReady.value = true;
        indexCount.value = msg.count;
        break;

      case "results": {
        const cb = callbacks.get(msg.id);
        if (cb) {
          cb(msg.results);
          callbacks.delete(msg.id);
        }
        break;
      }

      case "error": {
        // FIX: resolve with [] so callers never leak on worker errors
        if (msg.id != null) {
          const cb = callbacks.get(msg.id);
          cb?.([]);
          callbacks.delete(msg.id);
        }
        console.error("[SearchWorker]", msg.message);
        break;
      }
    }
  });

  return worker;
}

function post(msg: WorkerRequest) {
  ensureWorker().postMessage(msg);
}

function searchAsync(
  query: string,
  filter: SearchFilter,
  limit?: number,
): Promise<SearchResultItem[]> {
  return new Promise((resolve) => {
    const id = requestId++;
    callbacks.set(id, resolve);
    post({ action: "search", query, id, limit, filter });
  });
}

function groupResults(raw: SearchResultItem[]): GroupedResults {
  const result = createEmptyResults();

  for (const item of raw) {
    result.groups[item.type]?.push(item);
  }

  result.topResults = [...raw]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_RESULTS_COUNT);

  return result;
}

function ensureIndex(): Promise<void> {
  if (buildPromise) return buildPromise;

  buildPromise = buildSearchDocuments()
    .then((docs) => {
      post({ action: "build", documents: docs });
    })
    .catch((err) => {
      buildPromise = null;
      console.error("[Search] Failed to build index:", err);
    });

  return buildPromise!;
}

// ── Module-level shared state ─────────────────────────────────────────────────

const query = ref("");
const activeFilter = ref<SearchFilter>("all");
const results = shallowRef<GroupedResults>(createEmptyResults());
const isSearching = ref(false);

// Panel open state — shared between SidebarHeader and SearchPanel
const isSearchOpen = ref(false);

let latestSearchId = 0;

const debouncedSearch = useDebounceFn(async (q: string, filter: SearchFilter) => {
  if (!isReady.value) {
    await ensureIndex();

    if (!isReady.value) {
      await new Promise<void>((resolve) => {
        const unwatch = watch(isReady, (ready) => {
          if (ready) {
            unwatch();
            resolve();
          }
        });
        setTimeout(() => {
          unwatch();
          resolve();
        }, 5000);
      });
    }
  }

  if (!isReady.value) {
    isSearching.value = false;
    return;
  }

  const thisId = ++latestSearchId;
  const raw = await searchAsync(q, filter);

  if (thisId !== latestSearchId) return;

  results.value = groupResults(raw);
  isSearching.value = false;
}, DEBOUNCE_MS);

watch([query, activeFilter], ([q, filter]) => {
  const trimmed = q.trim();

  if (!trimmed) {
    results.value = createEmptyResults();
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  debouncedSearch(trimmed, filter);
});

const hasQuery = computed(() => query.value.trim().length > 0);

const availableFilters: { label: string; value: SearchFilter }[] = [
  { label: "all", value: "all" },
  ...SEARCH_ENTITY_TYPES.map(type => ({ label: type, value: type as SearchFilter })),
];

// ── Public composable ─────────────────────────────────────────────────────────

export function useSearch() {
  if (typeof window !== "undefined") {
    ensureIndex();
  }

  function openSearch() {
    isSearchOpen.value = true;
  }

  function closeSearch() {
    isSearchOpen.value = false;
  }

  function setFilter(filter: SearchFilter) {
    activeFilter.value = filter;
  }

  function addDocuments(docs: SearchDocument[]) {
    post({ action: "add", documents: docs });
  }

  function removeDocuments(ids: string[]) {
    post({ action: "remove", ids });
  }

  async function rebuildIndex() {
    isReady.value = false;
    buildPromise = null;
    await ensureIndex();
  }

  function clear() {
    query.value = "";
    activeFilter.value = "all";
  }

  return {
    query,
    activeFilter,
    availableFilters,
    results,
    isSearching,
    isSearchOpen: readonly(isSearchOpen),
    isReady: readonly(isReady),
    hasQuery,
    indexCount: readonly(indexCount),
    openSearch,
    closeSearch,
    setFilter,
    clear,
    addDocuments,
    removeDocuments,
    rebuildIndex,
  };
}
