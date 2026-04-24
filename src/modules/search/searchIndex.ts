import SearchWorkerCtor from "./search.worker?worker";
import { buildAllSearchDocuments } from "./buildDocuments";
import type {
  SearchDocument,
  SearchFilter,
  SearchResultItem,
  WorkerRequest,
  WorkerResponse,
} from "./types";

type PendingSearch = {
  resolve: (results: SearchResponse) => void;
  reject: (err: Error) => void;
};

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  totalDuration: number;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
}

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
      const pendingSearch = this.pending.get(msg.id);
      pendingSearch?.resolve({
        results: msg.results,
        total: msg.total,
        totalDuration: msg.totalDuration,
      });
      this.pending.delete(msg.id);
    }
    else if (msg.action === "error" && msg.id != null) {
      const pendingSearch = this.pending.get(msg.id);
      pendingSearch?.reject(new Error(msg.message));
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

  search(query: string, filter: SearchFilter, options?: SearchOptions): Promise<SearchResponse> {
    const id = ++this.idCounter;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({
        action: "search",
        query,
        id,
        filter,
        limit: options?.limit,
        offset: options?.offset,
      });
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
    .then(documents => getClient().build(documents))
    .catch((err) => {
      initPromise = null;
      return Promise.reject(err);
    });

  return initPromise;
}

export async function searchDocuments(
  query: string,
  filter: SearchFilter,
  options?: SearchOptions,
): Promise<SearchResponse> {
  await initSearchIndex();
  return getClient().search(query, filter, options);
}

export async function searchTracks(
  query: string,
  offset = 0,
  limit?: number,
) {
  const response = await searchDocuments(query, "track", {
    offset,
    limit,
  });

  return {
    tracks: response.results.flatMap(item => (item.track ? [item.track] : [])),
    total: response.total,
    totalDuration: response.totalDuration,
  };
}

export async function upsertSearchDocuments(documents: SearchDocument[]): Promise<void> {
  if (documents.length === 0) return;

  await initSearchIndex();
  getClient().add(documents);
}

export async function removeSearchDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await initSearchIndex();
  getClient().remove(ids);
}

export async function rebuildSearchIndex() {
  client?.terminate();
  client = null;
  initPromise = null;
  await initSearchIndex();
}
