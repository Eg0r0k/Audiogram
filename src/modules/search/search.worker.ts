import MiniSearch, { type SearchOptions, type SearchResult } from "minisearch";
import type {
  SearchDocument,
  SearchResultItem,
  WorkerRequest,
  WorkerResponse,
} from "./types";
import { buildSearchAliases, termProcessor, unicodeTokenizer } from "./searchNormalization";

interface IndexedSearchDocument extends SearchDocument {
  searchAliases: string;
}

let index: MiniSearch<IndexedSearchDocument> | null = null;

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  prefix: true,
  fuzzy: 0.2,
  boost: { title: 3, artist: 2, album: 1, searchAliases: 0.75 },
  tokenize: unicodeTokenizer,
  processTerm: termProcessor,
};

function createIndex(): MiniSearch<IndexedSearchDocument> {
  return new MiniSearch<IndexedSearchDocument>({
    fields: ["title", "artist", "album", "searchAliases"],
    storeFields: ["type", "title", "artist", "album", "entityId", "coverPath", "track"],
    tokenize: unicodeTokenizer,
    processTerm: termProcessor,
    searchOptions: DEFAULT_SEARCH_OPTIONS,
  });
}

function createIndexedDocument(document: SearchDocument): IndexedSearchDocument {
  return {
    ...document,
    searchAliases: buildSearchAliases(document.title, document.artist, document.album),
  };
}

function mapHit(hit: SearchResult): SearchResultItem {
  return {
    id: String(hit.id),
    type: hit.type as SearchResultItem["type"],
    title: hit.title as string,
    artist: hit.artist as string | undefined,
    album: hit.album as string | undefined,
    entityId: hit.entityId as string,
    coverPath: hit.coverPath as string | undefined,
    score: hit.score,
    track: hit.track as SearchResultItem["track"],
  };
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  try {
    switch (msg.action) {
      case "build": {
        index = createIndex();
        index.addAll(msg.documents.map(createIndexedDocument));
        post({ action: "ready", count: msg.documents.length });
        break;
      }

      case "search": {
        if (!index) {
          post({ action: "results", results: [], id: msg.id, total: 0, totalDuration: 0 });
          return;
        }

        const options: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS };

        if (msg.filter && msg.filter !== "all") {
          const filterType = msg.filter;
          options.filter = (result: SearchResult) => result.type === filterType;
        }

        const raw = index.search(msg.query, options);
        const offset = msg.offset ?? 0;
        const limit = msg.limit ?? 50;
        const total = raw.length;
        const totalDuration = raw.reduce((sum, hit) => {
          const track = hit.track as SearchResultItem["track"] | undefined;
          return sum + (track?.duration ?? 0);
        }, 0);
        const results = raw.slice(offset, offset + limit).map(mapHit);

        post({ action: "results", results, id: msg.id, total, totalDuration });
        break;
      }

      case "add": {
        if (!index) return;

        for (const doc of msg.documents) {
          index.discard(doc.id);
        }
        index.addAll(msg.documents.map(createIndexedDocument));
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
