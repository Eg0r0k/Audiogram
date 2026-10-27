import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { artistRepository } from "@/db/repositories";
import { trackRepository } from "@/db/repositories/track.repository";
import { TrackScope } from "@/db/repositories/track.scope";
import { createAlbumAndSync } from "@/queries/album.queries";
import { rebuildCounters } from "@/queries/track.queries";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn(async () => undefined), currentRoute: { value: { name: undefined, params: {} } } }),
}));

import { useLibrary } from "../useLibrary";

const ARTIST = ArtistId("ar1");

const entity = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "Artist",
  albumTitle: "",
  artistIds: [ARTIST],
  albumId: AlbumId(""),
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

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useLibrary on live reads", () => {
  let queryClient: QueryClient;
  let wrappers: VueWrapper[] = [];

  const mountLibrary = () => {
    let api!: ReturnType<typeof useLibrary>;
    wrappers.push(mount(
      defineComponent({
        setup() {
          api = useLibrary();
          return () => h("div");
        },
      }),
      { global: { plugins: [createPinia(), [VueQueryPlugin, { queryClient }]] } },
    ));
    return api;
  };

  const likedCount = (api: ReturnType<typeof useLibrary>) => api.allItems.value.find(item => item.type === "liked")?.count;

  const albumTitles = (api: ReturnType<typeof useLibrary>) =>
    api.allItems.value.filter(item => item.type === "album").map(item => item.title);

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.add({ id: ARTIST, name: "Artist", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.tracks.bulkAdd([entity("t1"), entity("t2", { likedAt: 5 })]);
    await rebuildCounters();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    for (const wrapper of wrappers) wrapper.unmount();
    wrappers = [];
    vi.restoreAllMocks();
  });

  it("a new album shows up in the sidebar without an invalidation", async () => {
    const api = mountLibrary();
    await until(() => !api.isLoading.value);
    await quiet();
    expect(albumTitles(api)).toEqual([]);

    await createAlbumAndSync(ARTIST, "Fresh");
    await until(() => albumTitles(api).includes("Fresh"));

    expect(api.allItems.value.find(item => item.type === "album")?.subtitle).toBe("Artist");
  });

  it("the liked count follows a like through the counter row", async () => {
    const count = vi.spyOn(TrackScope.prototype, "count");
    const api = mountLibrary();
    await until(() => !api.isLoading.value);
    await quiet();
    expect(likedCount(api)).toBe(1);

    await trackRepository.setLiked(TrackId("t1"), true);
    await until(() => likedCount(api) === 2);

    await db.counters.put({ id: "liked", count: 40, seconds: 4000 });
    await until(() => likedCount(api) === 40);

    expect(count).not.toHaveBeenCalled();
  });

  it("a failed summary read ends the loading state with the system rows", async () => {
    vi.spyOn(artistRepository, "findPinned").mockRejectedValueOnce(new Error("idb"));
    const api = mountLibrary();
    await until(() => !api.isLoading.value);

    expect(api.allItems.value.map(item => item.type)).toEqual(["liked", "allMedia"]);
  });

  it("every caller shares one summary read, and a like does not re-read it", async () => {
    const findPinned = vi.spyOn(artistRepository, "findPinned");
    const first = mountLibrary();
    const second = mountLibrary();
    await until(() => !first.isLoading.value && !second.isLoading.value);
    await quiet();

    expect(findPinned).toHaveBeenCalledTimes(1);

    await trackRepository.setLiked(TrackId("t1"), true);
    await until(() => likedCount(first) === 2 && likedCount(second) === 2);
    await quiet();

    // The count comes from the counter row; the four-table summary is not re-read for a like.
    expect(findPinned).toHaveBeenCalledTimes(1);
  });
});
