import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { defineComponent, h, nextTick, ref, watch, type Ref } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { TrackScope, type TrackPage, type TrackPageOptions, type TrackWindowOptions } from "@/db/repositories/track.scope";
import { resetSearchIndex } from "@/services/search/searchIndex";
import type { Track } from "@/types/track";
import { AlbumId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/modules/tracks/types";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/queries/track.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/queries/track.queries")>();
  return { ...actual, searchTrackIds: vi.fn(actual.searchTrackIds) };
});

import {
  getTracksByIds,
  searchTrackIds,
  toggleTrackLikeAndSync,
  updateTrackMetadataAndSync,
  type SearchedTrackIds,
} from "@/queries/track.queries";
import { useLikedTracksPage } from "../useLikedTracksPage";

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

const name = (prefix: string, index: number) => `${prefix}${String(index).padStart(3, "0")}`;

// 120 liked rows t000..t119, liked in that order, and unliked rows to like during a test.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 120 }, (_, i) => entity(name("t", i), { likedAt: 1000 + i })),
  entity("a000"),
  entity("x1", { title: "t025x" }),
  entity("x2", { title: "t049x" }),
];

const ascending = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => TrackId(name("t", from + i)));

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useLikedTracksPage on live pages", () => {
  let pageSpy: MockInstance<(options: TrackPageOptions) => Promise<TrackPage>>;
  let windowSpy: MockInstance<(options: TrackWindowOptions) => Promise<TrackEntity[]>>;
  let queryClient: QueryClient;
  let wrapper: VueWrapper | undefined;

  const mountPage = (sortKey: Ref<TrackSortKey | null>, searchQuery = ref("")) => {
    let api!: ReturnType<typeof useLikedTracksPage>;
    wrapper = mount(
      defineComponent({
        setup() {
          api = useLikedTracksPage(sortKey, searchQuery);
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );
    return api;
  };

  const ids = (api: ReturnType<typeof useLikedTracksPage>) => api.tracks.value.map(track => track.id);

  const loadPages = async (api: ReturnType<typeof useLikedTracksPage>, count: number) => {
    await until(() => !api.isLoading.value);
    for (let i = 1; i < count; i++) await api.fetchNextPage();
    await until(() => windowSpy.mock.calls.length >= count - 1);
    await quiet();
    pageSpy.mockClear();
    windowSpy.mockClear();
  };

  const trackOf = async (id: string): Promise<Track> => (await getTracksByIds([TrackId(id)]))[0];

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
    resetSearchIndex();
    vi.mocked(searchTrackIds).mockClear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    pageSpy = vi.spyOn(TrackScope.prototype, "page");
    windowSpy = vi.spyOn(TrackScope.prototype, "window");
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it("a like appears in the open first page without re-running the others", async () => {
    const api = mountPage(ref(null));
    await loadPages(api, 3);
    expect(api.tracks.value).toHaveLength(120);

    await toggleTrackLikeAndSync(queryClient, await trackOf("a000"));
    await until(() => ids(api)[0] === TrackId("a000"));
    await quiet();

    expect(ids(api)).toEqual([TrackId("a000"), ...ascending(0, 120).reverse()]);
    expect(api.likedData.value.trackCount).toBe(121);
    expect(pageSpy).not.toHaveBeenCalled();
    expect(windowSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [options] of windowSpy.mock.calls) expect(options.from).toBeNull();
  });

  it("an unlike shrinks only the page that held the row", async () => {
    const liked = trackRepository.liked();
    const p0 = await liked.page({ sort: "title_asc", limit: PAGE_SIZE });
    const p1 = await liked.page({ sort: "title_asc", after: p0.last, limit: PAGE_SIZE });
    const p2 = await liked.page({ sort: "title_asc", after: p1.last, limit: PAGE_SIZE });
    const api = mountPage(ref<TrackSortKey | null>("title_asc"));
    await loadPages(api, 3);

    await toggleTrackLikeAndSync(queryClient, await trackOf("t060"));
    await until(() => !ids(api).includes(TrackId("t060")));
    await quiet();

    expect(ids(api)).toEqual(ascending(0, 120).filter(id => id !== TrackId("t060")));
    expect(api.likedData.value.trackCount).toBe(119);
    expect(pageSpy).not.toHaveBeenCalled();
    expect(windowSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [options] of windowSpy.mock.calls) expect(options).toEqual({ sort: "title_asc", from: p1.first, to: p2.first });
  });

  it("load more freezes the previous page's upper bound", async () => {
    const api = mountPage(ref<TrackSortKey | null>("title_asc"));
    await loadPages(api, 2);
    expect(ids(api)).toEqual(ascending(0, 100));

    await toggleTrackLikeAndSync(queryClient, await trackOf("x1"));
    await until(() => ids(api).includes(TrackId("x1")));
    await quiet();

    expect(ids(api)).toEqual([...ascending(0, 26), TrackId("x1"), ...ascending(26, 100)]);
    expect(pageSpy).not.toHaveBeenCalled();
    for (const [options] of windowSpy.mock.calls) expect(options.from).toBeNull();

    await toggleTrackLikeAndSync(queryClient, await trackOf("x2"));
    await until(() => ids(api).includes(TrackId("x2")));
    await quiet();

    expect(new Set(ids(api)).size).toBe(ids(api).length);
    expect(ids(api).slice(49, 53)).toEqual([TrackId("t048"), TrackId("t049"), TrackId("x2"), TrackId("t050")]);
  });

  it("a sort change keeps the old rows until the first new page lands", async () => {
    const sortKey = ref<TrackSortKey | null>(null);
    const api = mountPage(sortKey);
    await loadPages(api, 1);
    const before = ids(api);
    expect(before).toEqual(ascending(70, 120).reverse());

    const shown: number[] = [];
    const loading: boolean[] = [];
    watch(api.tracks, tracks => shown.push(tracks.length), { flush: "sync" });
    watch(api.isLoading, value => loading.push(value), { flush: "sync" });

    sortKey.value = "title_asc";
    await nextTick();

    expect(ids(api)).toEqual(before);
    expect(api.isLoading.value).toBe(false);

    await until(() => ids(api)[0] === TrackId("t000"));

    expect(ids(api)).toEqual(ascending(0, 50));
    expect(shown.every(length => length > 0)).toBe(true);
    expect(loading).toEqual([]);
  });

  it("a search string switches to the search query and back without flashing an empty list", async () => {
    const searchQuery = ref("");
    const api = mountPage(ref(null), searchQuery);
    await loadPages(api, 1);
    const live = ids(api);
    const matches = api.tracks.value.slice(0, 2);
    let answer!: (found: SearchedTrackIds) => void;
    vi.mocked(searchTrackIds).mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));

    const shown: number[] = [];
    const loading: boolean[] = [];
    watch(api.tracks, tracks => shown.push(tracks.length), { flush: "sync" });
    watch(api.isLoading, value => loading.push(value), { flush: "sync" });

    searchQuery.value = "t11";
    await until(() => vi.mocked(searchTrackIds).mock.calls.length > 0);
    await flushPromises();

    const [query, within, sort] = vi.mocked(searchTrackIds).mock.calls[0];
    expect([query, sort]).toEqual(["t11", null]);
    expect([...within ?? []].sort()).toEqual(ascending(0, 120));
    expect(ids(api)).toEqual(live);

    answer({ ids: matches.map(track => track.id), matches: {}, total: 2, totalDuration: 200 });
    await until(() => api.tracks.value.length === 2);

    expect(ids(api)).toEqual(matches.map(track => track.id));
    expect(api.likedData.value.trackCount).toBe(2);
    expect(api.hasNextPage.value).toBe(false);

    searchQuery.value = "";
    await nextTick();

    expect(api.tracks.value).toHaveLength(2);

    await until(() => api.tracks.value.length === PAGE_SIZE);

    expect(ids(api)).toEqual(live);
    expect(api.likedData.value.trackCount).toBe(120);
    expect(shown.every(length => length > 0)).toBe(true);
    expect(loading).toEqual([]);
  });

  it("liked: a search string reads live rows and follows the index", async () => {
    const writer = new QueryClient();
    await db.tracks.update(TrackId("t005"), { title: "Glory Box" });
    await db.tracks.update(TrackId("t006"), { title: "Glory Days" });
    await db.tracks.update(TrackId("a000"), { title: "Glory Unliked" });
    const api = mountPage(ref(null), ref("glory"));
    await until(() => api.tracks.value.length === 2);

    expect([...ids(api)].sort()).toEqual([TrackId("t005"), TrackId("t006")]);
    expect(api.likedData.value.trackCount).toBe(2);

    await toggleTrackLikeAndSync(writer, await trackOf("a000"));
    await until(() => ids(api).includes(TrackId("a000")));

    expect(api.likedData.value.trackCount).toBe(3);

    await toggleTrackLikeAndSync(writer, await trackOf("t005"));
    await until(() => !ids(api).includes(TrackId("t005")));

    await updateTrackMetadataAndSync(writer, await trackOf("t006"), { title: "Sunny", artistNames: ["A"] });
    await until(() => !ids(api).includes(TrackId("t006")));

    expect(ids(api)).toEqual([TrackId("a000")]);
    expect(api.likedData.value.trackCount).toBe(1);
    expect(api.isError.value).toBe(false);
  });
});
