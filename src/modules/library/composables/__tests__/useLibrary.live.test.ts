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
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

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

  const rootTitles = (api: ReturnType<typeof useLibrary>) =>
    api.itemsByFilter.value.all.filter(item => !item.isSystem).map(item => item.title);

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

  it("a like changes the liked row and leaves every other row's identity alone", async () => {
    await createAlbumAndSync(ARTIST, "Fresh");
    const api = mountLibrary();
    await until(() => !api.isLoading.value);
    await quiet();

    const before = api.itemsByFilter.value.all;
    const artist = before.find(item => item.type === "artist");
    const album = before.find(item => item.type === "album");
    const liked = before.find(item => item.type === "liked");
    expect(artist).toBeDefined();
    expect(album).toBeDefined();

    await trackRepository.setLiked(TrackId("t1"), true);
    await until(() => likedCount(api) === 2);
    await quiet();

    const all = api.itemsByFilter.value.all;
    expect(all.find(item => item.type === "artist")).toBe(artist);
    expect(all.find(item => item.type === "album")).toBe(album);
    const nextLiked = all.find(item => item.type === "liked");
    expect(nextLiked).not.toBe(liked);
    expect(nextLiked?.count).toBe(2);
    expect(all[0].type).toBe("liked");
    expect(all[1].type).toBe("allMedia");
  });

  it("system rows lead the all and album lists and stay out of the artist and playlist lists", async () => {
    await createAlbumAndSync(ARTIST, "Fresh");
    const api = mountLibrary();
    await until(() => !api.isLoading.value);
    await quiet();

    const { all, album, artist, playlist } = api.itemsByFilter.value;
    const types = (items: typeof all) => items.map(item => item.type);
    expect(types(album).slice(0, 3)).toEqual(["liked", "allMedia", "album"]);
    expect(types(all).slice(0, 2)).toEqual(["liked", "allMedia"]);
    expect(types(artist)).toEqual(["artist"]);
    expect(types(playlist)).toEqual([]);
  });

  it("setSortKey reorders the sidebar rows and null restores newest first", async () => {
    await db.albums.add({ id: AlbumId("al1"), title: "Zebra", artistId: ARTIST, pinned: 1, addedAt: 3, updatedAt: 3 });
    await db.playlists.add({ id: PlaylistId("pl1"), name: "Mango", trackIds: [], addedAt: 2, updatedAt: 2 });
    const api = mountLibrary();
    await until(() => !api.isLoading.value && rootTitles(api).length === 3);

    expect(api.itemsByFilter.value.all.slice(0, 2).map(item => item.type)).toEqual(["liked", "allMedia"]);
    expect(rootTitles(api)).toEqual(["Zebra", "Mango", "Artist"]);

    api.setSortKey("alphabetical_asc");
    expect(rootTitles(api)).toEqual(["Artist", "Mango", "Zebra"]);

    api.setSortKey(null);
    expect(rootTitles(api)).toEqual(["Zebra", "Mango", "Artist"]);
  });
});
