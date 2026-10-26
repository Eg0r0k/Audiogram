import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { defineComponent, h, nextTick, ref, watch, type Ref } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { TrackScope, type TrackPage, type TrackPageOptions, type TrackWindowOptions } from "@/db/repositories/track.scope";
import { EntityResolver } from "@/services/entity-resolver";
import { persistTracks } from "@/services/import/track-persister";
import type { TrackToSave } from "@/services/types";
import type { SearchMatch } from "@/services/search/types";
import { resetSearchIndex } from "@/services/search/searchIndex";
import { invalidateLibraryData } from "@/queries/library.queries";
import type { Track } from "@/types/track";
import { AlbumId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/modules/tracks/types";

vi.mock("@/queries/track.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/queries/track.queries")>();
  return { ...actual, loadTrackRelations: vi.fn(actual.loadTrackRelations), searchTrackIds: vi.fn(actual.searchTrackIds) };
});

import {
  deleteTracksAndSync,
  getTracksByIds,
  loadTrackRelations,
  rebuildCounters,
  searchTrackIds,
  toggleTrackLikeAndSync,
  updateTrackMetadataAndSync,
  type SearchedTrackIds,
} from "@/queries/track.queries";
import { useIndexTracksPage } from "../useIndexTracksPage";

const PAGE_SIZE = 50;

const entity = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
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

const name = (index: number) => `t${String(index).padStart(3, "0")}`;

// 120 members t000..t119 added in that order, and a shadow that would lead both orders if it counted.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 120 }, (_, i) => entity(name(i), { addedAt: 1000 + i })),
  entity("s000", { pinned: 0, addedAt: 5000 }),
];

const ascending = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => TrackId(name(from + i)));

const descending = (from: number, to: number) => ascending(from, to).reverse();

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useIndexTracksPage on live pages", () => {
  let pageSpy: MockInstance<(options: TrackPageOptions) => Promise<TrackPage>>;
  let windowSpy: MockInstance<(options: TrackWindowOptions) => Promise<TrackEntity[]>>;
  let queryClient: QueryClient;
  let wrapper: VueWrapper | undefined;

  const mountPage = (sortKey: Ref<TrackSortKey | null>, searchQuery = ref("")) => {
    let api!: ReturnType<typeof useIndexTracksPage>;
    wrapper = mount(
      defineComponent({
        setup() {
          api = useIndexTracksPage(sortKey, searchQuery);
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );
    return api;
  };

  const ids = (api: ReturnType<typeof useIndexTracksPage>) => api.tracks.value.map(track => track.id);

  // Dexie's liveQuery listens for writes only after its first emission, so every window has to emit before a test writes.
  const loadPages = async (api: ReturnType<typeof useIndexTracksPage>, count: number) => {
    await until(() => !api.isLoading.value);
    for (let i = 1; i < count; i++) await api.fetchNextPage();
    await until(() => windowSpy.mock.calls.length >= count - 1);
    const relations = vi.mocked(loadTrackRelations).mock;
    await until(() => relations.calls.length >= 2 * count - 1
      && relations.settledResults.every(result => result.type !== "incomplete"));
    await quiet();
    pageSpy.mockClear();
    windowSpy.mockClear();
  };

  const trackOf = async (id: string): Promise<Track> => (await getTracksByIds([TrackId(id)]))[0];

  const importTrack = async (id: string) => {
    const item: TrackToSave = {
      trackId: TrackId(id),
      fileName: `${id}.mp3`,
      storagePath: `tracks/${id}.mp3`,
      fingerprint: `fp-${id}`,
      source: TrackSource.LOCAL_INTERNAL,
      meta: { title: id, artists: ["Imported"], album: "Imported", duration: 100, format: {} },
    };
    const resolver = new EntityResolver();
    await resolver.resolve([item.meta]);
    await persistTracks([item], resolver);
    await invalidateLibraryData(queryClient);
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
    await rebuildCounters();
    resetSearchIndex();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(loadTrackRelations).mockClear();
    vi.mocked(searchTrackIds).mockClear();
    pageSpy = vi.spyOn(TrackScope.prototype, "page");
    windowSpy = vi.spyOn(TrackScope.prototype, "window");
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it("/all: a track imported while the list is mounted appears in page 0 under date_added_desc", async () => {
    const api = mountPage(ref(null));
    await loadPages(api, 3);
    expect(ids(api)).toEqual(descending(0, 120));
    expect(api.total.value).toBe(120);

    await importTrack("new");
    await until(() => ids(api)[0] === TrackId("new"));
    await until(() => api.total.value === 121);
    await quiet();

    expect(ids(api)).toEqual([TrackId("new"), ...descending(0, 120)]);
    expect(pageSpy).not.toHaveBeenCalled();
    expect(windowSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [options] of windowSpy.mock.calls) expect(options).toMatchObject({ sort: "date_added_desc", from: null });
  });

  it("/all: deleting a row inside a window shrinks only that window", async () => {
    const members = trackRepository.members();
    const p0 = await members.page({ sort: "date_added_desc", limit: PAGE_SIZE });
    const p1 = await members.page({ sort: "date_added_desc", after: p0.last, limit: PAGE_SIZE });
    const p2 = await members.page({ sort: "date_added_desc", after: p1.last, limit: PAGE_SIZE });
    const api = mountPage(ref(null));
    await loadPages(api, 3);

    await deleteTracksAndSync(queryClient, [TrackId("t060")]);
    await until(() => !ids(api).includes(TrackId("t060")));
    await until(() => api.total.value === 119);
    await quiet();

    expect(ids(api)).toEqual(descending(0, 120).filter(id => id !== TrackId("t060")));
    expect(pageSpy).not.toHaveBeenCalled();
    expect(windowSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [options] of windowSpy.mock.calls) expect(options).toEqual({ sort: "date_added_desc", from: p1.first, to: p2.first });
  });

  it("/all: a sort change keeps the old rows until the first new page lands", async () => {
    const sortKey = ref<TrackSortKey | null>(null);
    const api = mountPage(sortKey);
    await loadPages(api, 1);
    const before = ids(api);
    expect(before).toEqual(descending(70, 120));

    const shown: number[] = [];
    const loading: boolean[] = [];
    watch(api.tracks, tracks => shown.push(tracks.length), { flush: "sync" });
    watch(api.isLoading, value => loading.push(value), { flush: "sync" });
    const countSpy = vi.spyOn(TrackScope.prototype, "count");

    sortKey.value = "title_asc";
    await nextTick();

    expect(ids(api)).toEqual(before);
    expect(api.isLoading.value).toBe(false);

    await until(() => ids(api)[0] === TrackId("t000"));

    expect(ids(api)).toEqual(ascending(0, 50));
    expect(api.resolvedSortKey.value).toBe("title_asc");
    expect(api.total.value).toBe(120);
    expect(countSpy).not.toHaveBeenCalled();
    expect(shown.every(length => length > 0)).toBe(true);
    expect(loading).toEqual([]);
  });

  it("the totals come from the counter row and no count query runs", async () => {
    const countSpy = vi.spyOn(TrackScope.prototype, "count");
    const api = mountPage(ref(null));
    await loadPages(api, 1);

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(api.total.value).toBe(120);

    await db.counters.put({ id: "members", count: 7, seconds: 0 });
    await until(() => api.total.value === 7);

    await trackRepository.create(entity("new", { addedAt: 9000 }));
    await until(() => api.total.value === 8);
    await until(() => ids(api)[0] === TrackId("new"));

    expect(countSpy).not.toHaveBeenCalled();
  });

  it("/all: a search string switches to the search query and back without an empty flash", async () => {
    const searchQuery = ref("");
    const api = mountPage(ref(null), searchQuery);
    await loadPages(api, 1);
    const live = ids(api);
    const hits = api.tracks.value.slice(0, 2);
    const match: SearchMatch = { terms: ["t119"], queryTerms: ["t11"] };
    let answer!: (found: SearchedTrackIds) => void;
    vi.mocked(searchTrackIds).mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));

    const shown: number[] = [];
    const loading: boolean[] = [];
    watch(api.tracks, tracks => shown.push(tracks.length), { flush: "sync" });
    watch(api.isLoading, value => loading.push(value), { flush: "sync" });

    searchQuery.value = "t11";
    await flushPromises();

    expect(vi.mocked(searchTrackIds)).toHaveBeenCalledWith("t11", undefined, null);
    expect(ids(api)).toEqual(live);
    expect(api.matches.value).toEqual({});

    answer({ ids: hits.map(track => track.id), matches: { [hits[0].id]: match }, total: 2, totalDuration: 200 });
    await until(() => api.tracks.value.length === 2);

    expect(ids(api)).toEqual(hits.map(track => track.id));
    expect(api.total.value).toBe(2);
    expect(api.matches.value).toEqual({ [hits[0].id]: match });
    expect(api.hasNextPage.value).toBe(false);

    searchQuery.value = "";
    await nextTick();

    expect(api.tracks.value).toHaveLength(2);

    await until(() => api.tracks.value.length === PAGE_SIZE);

    expect(ids(api)).toEqual(live);
    expect(api.total.value).toBe(120);
    expect(api.matches.value).toEqual({});
    expect(shown.every(length => length > 0)).toBe(true);
    expect(loading).toEqual([]);
  });

  it("/all: a search string reads live rows and follows the index", async () => {
    const writer = new QueryClient();
    await db.tracks.update(TrackId("t005"), { title: "Glory Box" });
    await db.tracks.update(TrackId("t006"), { title: "Glory Days" });
    const api = mountPage(ref(null), ref("glory"));
    await until(() => api.tracks.value.length === 2);

    expect([...ids(api)].sort()).toEqual([TrackId("t005"), TrackId("t006")]);
    expect(api.total.value).toBe(2);
    expect(Object.keys(api.matches.value).sort()).toEqual(["t005", "t006"]);
    expect(pageSpy).not.toHaveBeenCalled();

    await toggleTrackLikeAndSync(writer, await trackOf("t005"));
    await until(() => api.tracks.value.find(track => track.id === TrackId("t005"))?.isLiked === true);

    expect(vi.mocked(searchTrackIds)).toHaveBeenCalledTimes(1);

    await updateTrackMetadataAndSync(writer, await trackOf("t007"), { title: "Glory Road", artistNames: ["A"] });
    await until(() => ids(api).includes(TrackId("t007")));

    expect(api.total.value).toBe(3);
    expect(api.matches.value[TrackId("t007")]).toBeDefined();

    await updateTrackMetadataAndSync(writer, await trackOf("t006"), { title: "Sunny", artistNames: ["A"] });
    await until(() => !ids(api).includes(TrackId("t006")));

    expect([...ids(api)].sort()).toEqual([TrackId("t005"), TrackId("t007")]);
    expect(api.total.value).toBe(2);
    expect(api.isError.value).toBe(false);
  });
});
