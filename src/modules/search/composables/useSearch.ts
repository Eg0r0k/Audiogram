import { computed, readonly, ref, shallowRef, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import SearchWorkerCtor from "../search.worker?worker";
import {
  SEARCH_ENTITY_TYPES,
  createEmptyResults,
  type GroupedResults,
  type SearchDocument,
  type SearchFilter,
  type SearchResultItem,
  type WorkerResponse,
  type WorkerRequest,
} from "../types";
import { buildAllSearchDocuments } from "../buildDocuments";

const DEBOUNCE_MS = 150;
const TOP_RESULTS_COUNT = 6;

type PendingSearch = {
  resolve: (results: SearchResultItem[]) => void;
  reject: (err: Error) => void;
};

class SearchWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingSearch>();
  private idCounter = 0;

  constructor() {
    this.worker = new SearchWorkerCtor();
    this.worker.addEventListener("message", this.handleMessage);
  }

  private handleMessage = (e: MessageEvent<WorkerResponse>): void => {
    const msg = e.data;

    if (msg.action === "results") {
      const p = this.pending.get(msg.id);
      p?.resolve(msg.results);
      this.pending.delete(msg.id);
    }
    else if (msg.action === "error" && msg.id != null) {
      const p = this.pending.get(msg.id);
      p?.reject(new Error(msg.message));
      this.pending.delete(msg.id);
    }
  };

  build(documents: SearchDocument[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.action === "ready") {
          this.worker.removeEventListener("message", handler);
          resolve();
        }
        else if (msg.action === "error" && msg.id == null) {
          this.worker.removeEventListener("message", handler);
          reject(new Error(msg.message));
        }
      };

      this.worker.addEventListener("message", handler);
      this.post({ action: "build", documents });
    });
  }

  search(query: string, filter: SearchFilter, limit?: number): Promise<SearchResultItem[]> {
    const id = ++this.idCounter;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ action: "search", query, id, filter, limit });
    });
  }

  add(documents: SearchDocument[]): void {
    this.post({ action: "add", documents });
  }

  remove(ids: string[]): void {
    this.post({ action: "remove", ids });
  }

  terminate(): void {
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.terminate();
  }

  private post(msg: WorkerRequest): void {
    this.worker.postMessage(msg);
  }
}

let client: SearchWorkerClient | null = null;
let initPromise: Promise<void> | null = null;

function getClient(): SearchWorkerClient {
  if (!client) {
    client = new SearchWorkerClient();
  }
  return client;
}

export function initSearchIndex(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = buildAllSearchDocuments()
    .then(docs => getClient().build(docs))
    .catch((err) => {
      initPromise = null;
      return Promise.reject(err);
    });

  return initPromise;
}

const query = ref("");
const activeFilter = ref<SearchFilter>("all");
const results = shallowRef<GroupedResults>(createEmptyResults());
const isSearching = ref(false);
const isSearchOpen = ref(false);

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
    const raw = await getClient().search(q, filter, 50);

    if (thisId !== latestSearchId) return;

    results.value = groupResults(raw);
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
  return {
    query,
    activeFilter,
    availableFilters,
    results,
    isSearching: readonly(isSearching),
    isSearchOpen: readonly(isSearchOpen),
    hasQuery: computed(() => query.value.trim().length > 0),

    openSearch() { isSearchOpen.value = true; },
    closeSearch() { isSearchOpen.value = false; },

    setFilter(filter: SearchFilter) { activeFilter.value = filter; },

    clear() {
      query.value = "";
      activeFilter.value = "all";
    },

    addDocuments(docs: SearchDocument[]) {
      getClient().add(docs);
    },
    removeDocuments(ids: string[]) {
      getClient().remove(ids);
    },

    async rebuildIndex() {
      client?.terminate();
      client = null;
      initPromise = null;
      await initSearchIndex();
    },
  };
}
