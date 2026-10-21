import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

const PAGE_SIZE = 50;

vi.mock("@/queries/track.queries", () => ({
  getLikedTracksPaginated: vi.fn(async (offset: number) => ({
    tracks: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `track-${offset + i}` })),
    nextOffset: offset + PAGE_SIZE,
    total: PAGE_SIZE * 4,
  })),
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
});
