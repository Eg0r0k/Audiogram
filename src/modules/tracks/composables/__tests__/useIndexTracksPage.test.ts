import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

const PAGE_SIZE = 50;
const LIBRARY_TOTAL = 500; // 10 pages

// getAllTracksPaginated returns real rows so the flattened list length (what
// VirtualScrollable uses as itemCount) can be asserted; its key is the index
// of the row a page ends on.
vi.mock("@/queries/track.queries", () => ({
  getAllTracksPaginated: vi.fn(async (after: readonly number[] | null) => {
    const start = after === null ? 0 : after[0] + 1;
    const tracks = Array.from(
      { length: Math.max(0, Math.min(PAGE_SIZE, LIBRARY_TOTAL - start)) },
      (_, i) => ({ id: `track-${start + i}` }),
    );
    return { tracks, nextOffset: null, last: tracks.length === PAGE_SIZE ? [start + PAGE_SIZE - 1] : null, total: LIBRARY_TOTAL };
  }),
  searchTracksPaginated: vi.fn(async (_query: string, offset: number) => ({
    tracks: [{ id: `hit-${offset}` }],
    nextOffset: offset === 0 ? 1 : null,
    total: 2,
  })),
}));

import { getAllTracksPaginated, searchTracksPaginated } from "@/queries/track.queries";
import { useIndexTracksPage } from "../useIndexTracksPage";

function mountComposable(search = "") {
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
}

describe("useIndexTracksPage", () => {
  it("reads the list through the paged query alone, without a duration scan", async () => {
    const { wrapper, queryClient } = mountComposable();
    await flushPromises();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);

    wrapper.unmount();
  });

  it("keeps every page so a 500-track library scrolls to the last row (no maxPages cap)", async () => {
    const { api, wrapper } = mountComposable();
    await flushPromises();

    // Exhaust the infinite query the way the virtualizer's loadMore would.
    let guard = 0;
    while (api.hasNextPage.value && guard < 50) {
      await api.fetchNextPage();
      await flushPromises();
      guard++;
    }

    // maxPages would cap the flattened array (VirtualScrollable's itemCount) at
    // 200, freezing the container height; without it the whole library loads.
    expect(api.tracks.value.length).toBe(LIBRARY_TOTAL);
    expect(api.hasNextPage.value).toBe(false);

    wrapper.unmount();
  });

  it("keeps the loaded list on screen when only the next page fails", async () => {
    const { api, wrapper } = mountComposable();
    await flushPromises();
    vi.mocked(getAllTracksPaginated).mockRejectedValueOnce(new Error("idb"));

    await api.fetchNextPage();
    await flushPromises();

    expect(api.isError.value).toBe(false);
    expect(api.isFetchNextPageError.value).toBe(true);
    expect(api.tracks.value).toHaveLength(PAGE_SIZE);

    wrapper.unmount();
  });

  it("a search pages the index by offset from the first hit", async () => {
    vi.mocked(getAllTracksPaginated).mockClear();
    const { api, wrapper } = mountComposable("abba");
    await flushPromises();

    await api.fetchNextPage();
    await flushPromises();

    expect(vi.mocked(searchTracksPaginated).mock.calls.map(call => call[1])).toEqual([0, 1]);
    expect(api.tracks.value.map(track => track.id)).toEqual(["hit-0", "hit-1"]);
    expect(api.hasNextPage.value).toBe(false);
    expect(getAllTracksPaginated).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
