import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

const PAGE_SIZE = 50;

vi.mock("@/queries/track.queries", () => ({
  getLikedTracksPaginated: vi.fn(async (after: readonly number[] | null) => {
    const start = after === null ? 0 : after[0] + 1;
    return {
      tracks: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `track-${start + i}` })),
      nextOffset: null,
      last: [start + PAGE_SIZE - 1],
      total: PAGE_SIZE * 4,
    };
  }),
  searchLikedTracks: vi.fn(),
  trackQueries: { likedTotalDuration: () => ({ queryKey: ["liked-duration"], queryFn: async () => 0 }) },
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import { getLikedTracksPaginated } from "@/queries/track.queries";
import { useLikedTracksPage } from "../useLikedTracksPage";

const mountComposable = () => {
  let api!: ReturnType<typeof useLikedTracksPage>;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useLikedTracksPage(ref(null), ref(""));
        return () => h("div");
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  );
  return { api, wrapper };
};

describe("useLikedTracksPage", () => {
  it("keeps the loaded list on screen when only the next page fails", async () => {
    const { api, wrapper } = mountComposable();
    await flushPromises();
    vi.mocked(getLikedTracksPaginated).mockRejectedValueOnce(new Error("idb"));

    await api.fetchNextPage();
    await flushPromises();

    expect(api.isError.value).toBe(false);
    expect(api.isFetchNextPageError.value).toBe(true);
    expect(api.tracks.value).toHaveLength(PAGE_SIZE);

    wrapper.unmount();
  });

  it("resumes the liked list after the last key of the page before", async () => {
    vi.mocked(getLikedTracksPaginated).mockClear();
    const { api, wrapper } = mountComposable();
    await flushPromises();

    await api.fetchNextPage();
    await flushPromises();

    expect(vi.mocked(getLikedTracksPaginated).mock.calls.map(call => call[0])).toEqual([null, [PAGE_SIZE - 1]]);
    expect(api.tracks.value.map(track => track.id).slice(-1)).toEqual([`track-${PAGE_SIZE * 2 - 1}`]);
    expect(api.hasNextPage.value).toBe(true);

    wrapper.unmount();
  });
});
