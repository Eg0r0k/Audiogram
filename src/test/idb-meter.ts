//
// Counts the records an IndexedDB query actually visits.
//
// A cursor step and each row of a getAll() count as one record read, so a
// paged query that skips with `cursor.advance()` measures at its page size
// while one that walks record by record through a JS filter measures at
// offset + page size. `valueReads` counts only the visits that materialized a
// whole row — a key cursor and a native count() cost nothing there. Both
// differences are invisible in the returned rows and only show up as work
// done at the storage boundary.
//
// Test-only. Patches the global IDB prototypes for the duration of `run` and
// restores them afterwards, so measured and unmeasured code can interleave.
//

type Opener = (...args: never[]) => IDBRequest;

interface Counters {
  reads: number;
  valueReads: number;
}

interface Patch {
  proto: Record<string, unknown>;
  key: string;
  original: unknown;
}

export interface RecordReads<T> {
  result: T;
  /** Records visited, keys and values alike. */
  reads: number;
  /** Records whose full row was materialized. */
  valueReads: number;
}

const count = (counters: Counters, materializes: boolean) => {
  counters.reads++;
  if (materializes) counters.valueReads++;
};

// A cursor request fires `success` once per visited record, then once more
// with a null result at the end of the range.
const watchCursor = (request: IDBRequest, counters: Counters, materializes: boolean) => {
  request.addEventListener("success", () => {
    if (request.result !== null) count(counters, materializes);
  });
};

const watchGetAll = (request: IDBRequest, counters: Counters, materializes: boolean) => {
  request.addEventListener("success", () => {
    const rows = request.result as unknown;
    if (!Array.isArray(rows)) return;
    counters.reads += rows.length;
    if (materializes) counters.valueReads += rows.length;
  });
};

// A point lookup (bulkGet fans out into these) materializes one row.
const watchGet = (request: IDBRequest, counters: Counters) => {
  request.addEventListener("success", () => {
    if (request.result !== undefined) count(counters, true);
  });
};

type Watcher = (request: IDBRequest, counters: Counters) => void;

const wrap = (original: Opener, counters: Counters, watch: Watcher): Opener =>
  function (this: unknown, ...args: never[]) {
    const request = original.apply(this, args);
    watch(request, counters);
    return request;
  };

const cursorWatcher = (materializes: boolean): Watcher =>
  (request, counters) => watchCursor(request, counters, materializes);

const getAllWatcher = (materializes: boolean): Watcher =>
  (request, counters) => watchGetAll(request, counters, materializes);

const TARGETS: [unknown, string, Watcher][] = [
  [IDBObjectStore, "openCursor", cursorWatcher(true)],
  [IDBIndex, "openCursor", cursorWatcher(true)],
  [IDBObjectStore, "openKeyCursor", cursorWatcher(false)],
  [IDBIndex, "openKeyCursor", cursorWatcher(false)],
  [IDBObjectStore, "getAll", getAllWatcher(true)],
  [IDBIndex, "getAll", getAllWatcher(true)],
  [IDBObjectStore, "getAllKeys", getAllWatcher(false)],
  [IDBIndex, "getAllKeys", getAllWatcher(false)],
  [IDBObjectStore, "get", watchGet],
  [IDBIndex, "get", watchGet],
];

export const measureRecordReads = async <T>(run: () => Promise<T>): Promise<RecordReads<T>> => {
  const counters: Counters = { reads: 0, valueReads: 0 };
  const patches: Patch[] = [];

  for (const [target, key, watch] of TARGETS) {
    const proto = (target as { prototype: Record<string, unknown> }).prototype;
    const original = proto[key];
    if (typeof original !== "function") continue;
    patches.push({ proto, key, original });
    proto[key] = wrap(original as Opener, counters, watch);
  }

  try {
    const result = await run();
    return { result, reads: counters.reads, valueReads: counters.valueReads };
  }
  finally {
    for (const { proto, key, original } of patches) {
      proto[key] = original;
    }
  }
};
