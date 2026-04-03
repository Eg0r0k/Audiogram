import MiniSearch, { type SearchOptions, type SearchResult } from "minisearch";
import type {
  SearchDocument,
  SearchResultItem,
  WorkerRequest,
  WorkerResponse,
} from "./types";

let index: MiniSearch<SearchDocument> | null = null;

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

const unicodeTokenizer = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 0);

const termProcessor = (term: string): string | null => {
  const lower = term.toLowerCase();
  return lower.length >= 1 ? lower : null;
};

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  prefix: true,
  fuzzy: 0.2,
  boost: { title: 3, artist: 2, album: 1 },
  tokenize: unicodeTokenizer,
  processTerm: termProcessor,
};

function createIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ["title", "artist", "album"],
    storeFields: ["type", "title", "artist", "album", "entityId"],
    tokenize: unicodeTokenizer,
    processTerm: termProcessor,
    searchOptions: DEFAULT_SEARCH_OPTIONS,
  });
}

function mapHit(hit: SearchResult): SearchResultItem {
  return {
    id: String(hit.id),
    type: hit.type as SearchResultItem["type"],
    title: hit.title as string,
    artist: hit.artist as string | undefined,
    album: hit.album as string | undefined,
    entityId: hit.entityId as string,
    score: hit.score,
  };
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  try {
    switch (msg.action) {
      case "build": {
        index = createIndex();
        index.addAll(msg.documents);
        post({ action: "ready", count: msg.documents.length });
        break;
      }

      case "search": {
        if (!index) {
          post({ action: "results", results: [], id: msg.id });
          return;
        }

        const options: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS };

        if (msg.filter && msg.filter !== "all") {
          const filterType = msg.filter;
          options.filter = (result: SearchResult) => result.type === filterType;
        }

        const raw = index.search(msg.query, options);
        const results = raw.slice(0, msg.limit ?? 50).map(mapHit);

        post({ action: "results", results, id: msg.id });
        break;
      }

      case "add": {
        if (!index) return;

        for (const doc of msg.documents) {
          index.discard(doc.id);
        }
        index.addAll(msg.documents);
        break;
      }

      case "remove": {
        if (!index) return;

        for (const id of msg.ids) {
          index.discard(id);
        }
        break;
      }
    }
  }
  catch (err) {
    post({
      action: "error",
      message: err instanceof Error ? err.message : "Unknown worker error",
      id: "id" in msg ? (msg as { id: number }).id : undefined,
    });
  }
};
