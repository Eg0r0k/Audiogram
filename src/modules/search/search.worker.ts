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

const unicodeTokenizer = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 0);
};

const termProcessor = (term: string): string | null => {
  const lower = term.toLowerCase();
  return lower.length >= 1 ? lower : null;
};

function createIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ["title", "artist", "album"],
    storeFields: ["type", "title", "artist", "album", "coverPath", "entityId"],
    tokenize: unicodeTokenizer,
    processTerm: termProcessor,
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, artist: 2, album: 1 },
      tokenize: unicodeTokenizer,
      processTerm: termProcessor,
    },
  });
}

function mapHit(hit: SearchResult): SearchResultItem {
  return {
    id: String(hit.id),
    type: hit.type as SearchResultItem["type"],
    title: hit.title as string,
    artist: hit.artist as string | undefined,
    album: hit.album as string | undefined,
    coverPath: hit.coverPath as string | undefined,
    entityId: hit.entityId as string,
    score: hit.score,
  };
}

function getRequestId(msg: WorkerRequest): number | undefined {
  return "id" in msg ? msg.id : undefined;
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

        const options: SearchOptions = {};

        const filterValue = msg.filter;
        if (filterValue && filterValue !== "all") {
          options.filter = (result: SearchResult) =>
            String(result.type) === filterValue;
        }

        const raw = index.search(msg.query, options);
        const limited = raw.slice(0, msg.limit ?? 50);
        const results: SearchResultItem[] = limited.map(mapHit);

        post({ action: "results", results, id: msg.id });
        break;
      }

      case "add": {
        if (!index) return;
        for (const doc of msg.documents) {
          if (index.has(doc.id)) {
            index.discard(doc.id);
          }
        }
        index.addAll(msg.documents);
        break;
      }

      case "remove": {
        if (!index) return;
        for (const id of msg.ids) {
          if (index.has(id)) {
            index.discard(id);
          }
        }
        break;
      }
    }
  }
  catch (err) {
    post({
      action: "error",
      message: err instanceof Error ? err.message : "Unknown error",
      id: getRequestId(msg),
    });
  }
};
