import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { TrackScope } from "@/db/repositories/track.scope";
import { AlbumId, TrackId } from "@/types/ids";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import { useLikedTracksPage } from "../useLikedTracksPage";

const PAGE_SIZE = 50;

const name = (index: number) => `track-${String(index).padStart(3, "0")}`;

// Liked newest first, so the list reads track-000, track-001, ...
const SEED: TrackEntity[] = Array.from({ length: PAGE_SIZE * 4 }, (_, i) => ({
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
  addedAt: 1,
  likedAt: 10_000 - i,
}));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

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
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("resumes the liked list after the last key of the page before", async () => {
    const first = await trackRepository.liked().page({ limit: PAGE_SIZE });
    const page = vi.spyOn(TrackScope.prototype, "page");
    const { api, wrapper } = mountComposable();
    await until(() => !api.isLoading.value);

    await api.fetchNextPage();

    expect(page.mock.calls.map(([options]) => options.after ?? null)).toEqual([null, first.last]);
    expect(api.tracks.value.map(track => track.id).slice(-1)).toEqual([name(PAGE_SIZE * 2 - 1)]);
    expect(api.hasNextPage.value).toBe(true);

    wrapper.unmount();
  });
});
