import "fake-indexeddb/auto";
import { liveQuery, type Subscription } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { TrackScope, type TrackPage, type TrackPageOptions, type TrackWindowOptions } from "@/db/repositories/track.scope";
import { AlbumId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/types/track-sort";
import { LivePages } from "../livePages";

const SORT: TrackSortKey = "title_desc";
const PAGE_SIZE = 50;

const track = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId("al1"),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: `tracks/${id}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
  ...overrides,
});

const name = (prefix: string, index: number) => `${prefix}${String(index).padStart(3, "0")}`;

// 120 liked rows t000..t119 and 40 unliked a000..a039; by title descending the a rows sort after every t row.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 120 }, (_, i) => track(name("t", i), { likedAt: 1000 + i })),
  ...Array.from({ length: 40 }, (_, i) => track(name("a", i))),
];

const ascending = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => TrackId(name(prefix, from + i)));

const descending = (prefix: string, from: number, to: number) => ascending(prefix, from, to).reverse();

type Subscribe = (...args: unknown[]) => Subscription;

const observableProto = Object.getPrototypeOf(liveQuery(() => 0)) as { subscribe: Subscribe };

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const readWindow = TrackScope.prototype.window;

describe("LivePages", () => {
  let pageSpy: MockInstance<(options: TrackPageOptions) => Promise<TrackPage>>;
  let windowSpy: MockInstance<(options: TrackWindowOptions) => Promise<TrackEntity[]>>;
  let waiters: (() => void)[] = [];
  let live: LivePages<TrackId> | undefined;

  const onChange = vi.fn(() => {
    const ready = waiters;
    waiters = [];
    ready.forEach(resolve => resolve());
  });

  const until = async (holds: () => boolean) => {
    while (!holds()) await new Promise<void>(resolve => waiters.push(resolve));
  };

  const create = () => {
    live = new LivePages<TrackId>({
      scope: () => trackRepository.liked(),
      sort: () => SORT,
      map: async rows => rows.map(row => row.id),
      pageSize: PAGE_SIZE,
      onChange,
    });
    return live;
  };

  const keys = async () => {
    const liked = trackRepository.liked();
    const p0 = await liked.page({ sort: SORT, limit: PAGE_SIZE });
    const p1 = await liked.page({ sort: SORT, after: p0.last, limit: PAGE_SIZE });
    const p2 = await liked.page({ sort: SORT, after: p1.last, limit: PAGE_SIZE });
    return { p0, p1, p2 };
  };

  const loadThreePages = async () => {
    const pages = create();
    pages.start();
    await until(() => pages.isLoaded);
    await pages.loadMore();
    await pages.loadMore();
    await until(() => windowSpy.mock.calls.length >= 2);
    await quiet();
    pageSpy.mockClear();
    windowSpy.mockClear();
    return pages;
  };

  const pageCalls = () => pageSpy.mock.calls.map(([options]) => options);
  const windowCalls = () => windowSpy.mock.calls.map(([options]) => options);
  const rowsOf = (pages: LivePages<TrackId>) => pages.pages.map(page => page.rows);

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
    waiters = [];
    onChange.mockClear();
    pageSpy = vi.spyOn(TrackScope.prototype, "page");
    windowSpy = vi.spyOn(TrackScope.prototype, "window");
  });

  afterEach(() => {
    live?.dispose();
    live = undefined;
    vi.restoreAllMocks();
  });

  it("start opens page 0 as an open page and reports hasMore for a full page", async () => {
    const pages = create();
    pages.start();

    expect(pages.isLoaded).toBe(false);
    expect(pages.pages).toEqual([]);
    expect(pages.hasMore).toBe(false);

    await until(() => pages.isLoaded);

    expect(pages.pages).toEqual([{ from: null, to: null, rows: descending("t", 70, 120) }]);
    expect(pages.hasMore).toBe(true);
    expect(pages.isLoadingMore).toBe(false);
    expect(pageCalls()).toEqual([{ sort: SORT, after: null, limit: PAGE_SIZE }]);
    expect(windowSpy).not.toHaveBeenCalled();
  });

  it("loadMore turns the open page into a window and opens the next page after its last key", async () => {
    const { p0, p1 } = await keys();
    const pages = create();
    pages.start();
    await until(() => pages.isLoaded);
    pageSpy.mockClear();

    const loading = pages.loadMore();
    expect(pages.isLoadingMore).toBe(true);
    await loading;

    expect(pages.isLoadingMore).toBe(false);
    expect(pageCalls()).toEqual([{ sort: SORT, after: p0.last, limit: PAGE_SIZE }]);
    expect(pages.pages.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: null, to: p1.first },
      { from: p1.first, to: null },
    ]);
    expect(rowsOf(pages)).toEqual([descending("t", 70, 120), descending("t", 20, 70)]);
    expect(pages.hasMore).toBe(true);

    await until(() => windowSpy.mock.calls.length > 0);
    await quiet();

    expect(windowCalls()).toEqual([{ sort: SORT, from: null, to: p1.first }]);
    expect(pageCalls()).toHaveLength(1);
    expect(rowsOf(pages)).toEqual([descending("t", 70, 120), descending("t", 20, 70)]);
  });

  it("a like that lands in the open page re-runs only the open page", async () => {
    const { p1 } = await keys();
    const pages = await loadThreePages();
    expect(rowsOf(pages).map(rows => rows.length)).toEqual([50, 50, 20]);

    await trackRepository.setLiked(TrackId("a000"), true);
    await until(() => pages.pages[2].rows.includes(TrackId("a000")));
    await quiet();

    expect(rowsOf(pages)).toEqual([
      descending("t", 70, 120),
      descending("t", 20, 70),
      [...descending("t", 0, 20), TrackId("a000")],
    ]);
    expect(windowSpy).not.toHaveBeenCalled();
    expect(pageCalls().length).toBeGreaterThan(0);
    for (const options of pageCalls()) expect(options).toEqual({ sort: SORT, after: p1.last, limit: PAGE_SIZE });
  });

  it("an unlike inside a window re-runs only that window", async () => {
    const { p1, p2 } = await keys();
    const pages = await loadThreePages();

    await trackRepository.setLiked(TrackId("t060"), false);
    await until(() => !pages.pages[1].rows.includes(TrackId("t060")));
    await quiet();

    expect(rowsOf(pages).map(rows => rows.length)).toEqual([50, 49, 20]);
    expect(pages.pages[1].rows).toEqual(descending("t", 20, 70).filter(id => id !== TrackId("t060")));
    expect(pageSpy).not.toHaveBeenCalled();
    expect(windowCalls().length).toBeGreaterThan(0);
    for (const options of windowCalls()) expect(options).toEqual({ sort: SORT, from: p1.first, to: p2.first });
  });

  it("a short last page clears hasMore and stays open", async () => {
    const { p1 } = await keys();
    const pages = await loadThreePages();

    expect(pages.hasMore).toBe(false);
    expect(pages.pages).toHaveLength(3);
    expect(pages.pages[2].to).toBeNull();

    await pages.loadMore();
    expect(pageSpy).not.toHaveBeenCalled();

    await trackRepository.likeMany(ascending("a", 0, 30), 5000);
    await until(() => pages.pages[2].rows.length === 50);
    expect(pages.hasMore).toBe(true);

    const full = await trackRepository.liked().page({ sort: SORT, after: p1.last, limit: PAGE_SIZE });
    pageSpy.mockClear();
    await pages.loadMore();

    expect(pageCalls()).toEqual([{ sort: SORT, after: full.last, limit: PAGE_SIZE }]);
    expect(pages.hasMore).toBe(false);
    expect(pages.isLoadingMore).toBe(false);
    expect(pages.pages).toHaveLength(3);
    expect(pages.pages[2].to).toBeNull();

    pageSpy.mockClear();
    windowSpy.mockClear();
    await trackRepository.setLiked(TrackId("t010"), false);
    await until(() => !pages.pages[2].rows.includes(TrackId("t010")));
    await quiet();

    expect(pages.pages[2].rows).toHaveLength(49);
    expect(pages.hasMore).toBe(false);
    expect(windowSpy).not.toHaveBeenCalled();
    expect(pageCalls().length).toBeGreaterThan(0);
    for (const options of pageCalls()) expect(options).toEqual({ sort: SORT, after: p1.last, limit: PAGE_SIZE });
  });

  it("reset unsubscribes every page", async () => {
    const subscribe = vi.spyOn(observableProto, "subscribe");
    const pages = await loadThreePages();
    const subscriptions = subscribe.mock.results.map(result => result.value as Subscription);
    expect(subscriptions.filter(subscription => !subscription.closed)).toHaveLength(3);

    pages.reset();

    expect(subscriptions.every(subscription => subscription.closed)).toBe(true);
    expect(pages.pages).toEqual([]);
    expect(pages.isLoaded).toBe(false);
    expect(pages.hasMore).toBe(false);

    onChange.mockClear();
    await trackRepository.setLiked(TrackId("a000"), true);
    await trackRepository.setLiked(TrackId("t000"), false);
    await trackRepository.setLiked(TrackId("t060"), false);
    await quiet();

    expect(pageSpy).not.toHaveBeenCalled();
    expect(windowSpy).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a page that throws ends its subscription and reports the error", async () => {
    const subscribe = vi.spyOn(observableProto, "subscribe");
    const pages = await loadThreePages();
    const boom = new Error("boom");
    windowSpy.mockRejectedValueOnce(boom);

    await trackRepository.setLiked(TrackId("t060"), false);
    await until(() => pages.error !== undefined);

    expect(pages.error).toBe(boom);
    expect(subscribe.mock.results.filter(result => !(result.value as Subscription).closed)).toHaveLength(2);
    expect(rowsOf(pages).map(rows => rows.length)).toEqual([50, 50, 20]);

    pages.reset();
    pages.start();
    await until(() => pages.isLoaded);

    expect(pages.error).toBeUndefined();
    expect(rowsOf(pages)).toEqual([descending("t", 70, 120)]);
  });

  it("a row deleted while a new window is taking its first read is not left behind", async () => {
    const gate = deferred();
    // A promise resolved inside a querier pulls whoever awaits it into Dexie's liveQuery zone, where a write throws.
    let hasRead = false;
    windowSpy.mockImplementationOnce(async function (this: TrackScope, options) {
      const rows = await readWindow.call(this, options);
      hasRead = true;
      await gate.promise;
      return rows;
    });
    const pages = create();
    pages.start();
    await until(() => pages.isLoaded);
    await pages.loadMore();
    await vi.waitFor(() => expect(hasRead).toBe(true));

    await trackRepository.delete(TrackId("t100"));
    gate.resolve();

    await vi.waitFor(() => expect(pages.pages[0].rows).not.toContain(TrackId("t100")));
    await quiet();

    expect(rowsOf(pages)).toEqual([
      descending("t", 70, 120).filter(id => id !== TrackId("t100")),
      descending("t", 20, 70),
    ]);
    expect(pages.error).toBeUndefined();
  });
});
