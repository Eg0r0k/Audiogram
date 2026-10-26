import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { TrackScope } from "@/db/repositories/track.scope";
import { queryKeys } from "@/queries/query-keys";
import { AlbumId, TrackId } from "@/types/ids";

const PAGE_SIZE = 50;
const LIBRARY_TOTAL = 500;

vi.mock("@/queries/track.queries", async importOriginal => ({
  ...await importOriginal<typeof import("@/queries/track.queries")>(),
  searchTrackIds: vi.fn(),
}));

import { searchTrackIds } from "@/queries/track.queries";
import { useIndexTracksPage } from "../useIndexTracksPage";

const name = (index: number) => `track-${String(index).padStart(3, "0")}`;

// Added oldest first, so the default order (newest first) reads track-499, track-498, ...
const SEED: TrackEntity[] = Array.from({ length: LIBRARY_TOTAL }, (_, i) => ({
  id: TrackId(name(i)),
  title: name(i),
  artistName: "A",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId("al1"),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: `tracks/${name(i)}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1000 + i,
}));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

const mountComposable = (search = "") => {
  let api!: ReturnType<typeof useIndexTracksPage>;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useIndexTracksPage(ref(null), ref(search));
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  return { api, wrapper, queryClient };
};

describe("useIndexTracksPage", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the list through live pages and the member count alone, without a duration scan", async () => {
    const sumDuration = vi.spyOn(TrackScope.prototype, "sumDuration");
    const { api, wrapper, queryClient } = mountComposable();
    await until(() => !api.isLoading.value);

    const fetched = queryClient.getQueryCache().getAll().filter(query => query.state.data !== undefined);
    expect(fetched.map(query => query.queryKey)).toEqual([queryKeys.tracks.memberCount()]);
    expect(api.total.value).toBe(LIBRARY_TOTAL);
    expect(api.tracks.value).toHaveLength(PAGE_SIZE);
    expect(sumDuration).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("keeps every page so a 500-track library scrolls to the last row (no maxPages cap)", async () => {
    const { api, wrapper } = mountComposable();
    await until(() => !api.isLoading.value);

    let guard = 0;
    while (api.hasNextPage.value && guard < 50) {
      await api.fetchNextPage();
      guard++;
    }

    expect(api.tracks.value.length).toBe(LIBRARY_TOTAL);
    expect(api.tracks.value.map(track => track.id).slice(-1)).toEqual([name(0)]);
    expect(api.hasNextPage.value).toBe(false);

    wrapper.unmount();
  });

  it("keeps the loaded list on screen when only the next page fails", async () => {
    const { api, wrapper } = mountComposable();
    await until(() => !api.isLoading.value);
    const failure = new Error("idb");
    vi.spyOn(TrackScope.prototype, "page").mockRejectedValueOnce(failure);

    await api.fetchNextPage();

    expect(api.isError.value).toBe(false);
    expect(api.isFetchNextPageError.value).toBe(true);
    expect(api.error.value).toBe(failure);
    expect(api.isFetchingNextPage.value).toBe(false);
    expect(api.tracks.value).toHaveLength(PAGE_SIZE);

    await api.fetchNextPage();

    expect(api.isFetchNextPageError.value).toBe(false);
    expect(api.tracks.value).toHaveLength(PAGE_SIZE * 2);

    wrapper.unmount();
  });

  it("a search reads its hit ids one page at a time, without the live pages", async () => {
    const hits = Array.from({ length: 60 }, (_, i) => TrackId(name(i)));
    vi.mocked(searchTrackIds).mockClear().mockResolvedValueOnce({ ids: hits, matches: {}, total: 60, totalDuration: 6000 });
    const page = vi.spyOn(TrackScope.prototype, "page");
    const { api, wrapper } = mountComposable("abba");
    await until(() => !api.isLoading.value);

    expect(api.tracks.value.map(track => track.id)).toEqual(hits.slice(0, PAGE_SIZE));
    expect(api.total.value).toBe(60);
    expect(api.hasNextPage.value).toBe(true);

    await api.fetchNextPage();

    expect(api.tracks.value.map(track => track.id)).toEqual(hits);
    expect(api.hasNextPage.value).toBe(false);
    expect(vi.mocked(searchTrackIds)).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
