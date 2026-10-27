import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type AlbumEntity, type TrackEntity } from "@/db/entities";
import { TrackScope } from "@/db/repositories/track.scope";
import { resetSearchIndex, syncSearchIndex } from "@/services/search/searchIndex";
import { updateAlbumAndSync } from "@/queries/album.queries";
import { addTracksToAlbumAndSync, getTracksByIds } from "@/queries/track.queries";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/modules/tracks/types";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: { count?: number }) => (params ? `${key}:${params.count}` : key) }),
}));
const routing = vi.hoisted(() => ({ route: { params: {}, query: {} } as { params: { id?: string }; query: object } }));
vi.mock("vue-router", async () => {
  const { reactive } = await import("vue");
  routing.route = reactive({ params: { id: "al1" }, query: {} });
  return { useRoute: () => routing.route, useRouter: () => ({ push: vi.fn(async () => undefined) }) };
});
vi.mock("@/modules/covers/composables/useEntityCover", async () => {
  const { ref } = await import("vue");
  return { useEntityCover: () => ({ url: ref(null), isLoading: ref(false) }) };
});

import { useAlbumPage } from "../useAlbumPage";

const ALBUM = AlbumId("al1");
const ARTIST = ArtistId("ar1");

const ALBUM_ROW: AlbumEntity = { id: ALBUM, title: "Album", artistId: ARTIST, pinned: 1, addedAt: 1, updatedAt: 1 };

const entity = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [ARTIST],
  albumId: ALBUM,
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

// 120 album tracks t000..t119 numbered 120..1, so neither the id nor the title order is the track order, and one outside the album.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 120 }, (_, i) => entity(name(i), { diskNo: 1, trackNo: 120 - i })),
  entity("x000", { albumId: AlbumId("al2"), albumTitle: "Other", diskNo: 1, trackNo: 0, duration: 600 }),
];

const inTrackOrder = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => TrackId(name(119 - from - i)));

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useAlbumPage on live reads", () => {
  let queryClient: QueryClient;
  let wrapper: VueWrapper | undefined;

  const mountPage = (sortKey: Ref<TrackSortKey | null> = ref(null), searchQuery = ref("")) => {
    let api!: ReturnType<typeof useAlbumPage>;
    wrapper = mount(
      defineComponent({
        setup() {
          api = useAlbumPage(sortKey, searchQuery);
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );
    return api;
  };

  const ids = (api: ReturnType<typeof useAlbumPage>) => api.tracks.value.map(track => track.id);

  const loaded = async (api: ReturnType<typeof useAlbumPage>) => {
    await until(() => !api.isLoading.value);
    await quiet();
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.add({ id: ARTIST, name: "Artist", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.albums.bulkAdd([ALBUM_ROW, { ...ALBUM_ROW, id: AlbumId("al2"), title: "Other" }]);
    await db.tracks.bulkAdd(SEED);
    resetSearchIndex();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    routing.route.params.id = "al1";
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it("album: a track added to the album appears in the list without a refetch", async () => {
    const api = mountPage();
    await loaded(api);
    expect(ids(api)).toEqual(inTrackOrder(0, 50));
    expect(api.trackCount.value).toBe(120);
    expect(api.albumData.value?.duration).toBe("common.hoursShort:3 common.minutesShort:20");
    expect(api.isError.value).toBe(false);

    const [track] = await getTracksByIds([TrackId("x000")]);
    await addTracksToAlbumAndSync(ALBUM, [track]);
    await until(() => ids(api)[0] === TrackId("x000"));
    await until(() => api.trackCount.value === 121);

    expect(ids(api)).toEqual([TrackId("x000"), ...inTrackOrder(0, 49)]);
    expect(api.albumData.value?.trackCount).toBe(121);
    expect(api.albumData.value?.duration).toBe("common.hoursShort:3 common.minutesShort:30");
    expect(api.hasNextPage.value).toBe(true);
  });

  it("album: renaming the album updates the header row", async () => {
    const api = mountPage();
    await loaded(api);
    expect(api.album.value?.title).toBe("Album");
    expect(api.albumData.value?.artistName).toBe("Artist");

    await updateAlbumAndSync(ALBUM_ROW, { title: "Renamed" });
    await until(() => api.album.value?.title === "Renamed");
    await until(() => api.tracks.value[0]?.albumName === "Renamed");

    expect(api.albumData.value?.title).toBe("Renamed");
    expect(api.albumData.value?.artistName).toBe("Artist");
    expect(api.tracks.value.every(track => track.albumName === "Renamed")).toBe(true);

    await db.artists.update(ARTIST, { name: "Renamed artist" });
    await until(() => api.albumData.value?.artistName === "Renamed artist");
  });

  it("album: the list grows by one page per fetchNextPage and stops at the end", async () => {
    const api = mountPage();
    await loaded(api);
    expect(ids(api)).toEqual(inTrackOrder(0, 50));
    expect(api.hasNextPage.value).toBe(true);
    const rows = vi.spyOn(TrackScope.prototype, "rows");

    await api.fetchNextPage();

    expect(ids(api)).toEqual(inTrackOrder(0, 100));
    expect(api.hasNextPage.value).toBe(true);
    expect(api.isFetchingNextPage.value).toBe(false);
    expect(rows).toHaveBeenCalledTimes(1);

    await api.fetchNextPage();

    expect(ids(api)).toEqual(inTrackOrder(0, 120));
    expect(api.hasNextPage.value).toBe(false);
    expect(api.trackCount.value).toBe(120);
    expect(rows).toHaveBeenCalledTimes(2);

    await api.fetchNextPage();
    await quiet();

    expect(rows).toHaveBeenCalledTimes(2);
    expect(ids(api)).toHaveLength(120);
    expect(api.isFetchNextPageError.value).toBe(false);
  });

  it("album: a page sliding out keeps its album when the route moves on", async () => {
    const api = mountPage();
    await loaded(api);
    const before = ids(api);
    const rows = vi.spyOn(TrackScope.prototype, "rows");

    routing.route.params.id = "ar1";
    await quiet();

    expect(api.isError.value).toBe(false);
    expect(api.isLoading.value).toBe(false);
    expect(api.album.value?.id).toBe(ALBUM);
    expect(ids(api)).toEqual(before);
    expect(rows).not.toHaveBeenCalled();
  });

  it("album: a search string reads live rows and follows the index", async () => {
    await db.tracks.update(TrackId("t005"), { title: "Glory Box" });
    await db.tracks.update(TrackId("t006"), { title: "Glory Days" });
    await db.tracks.update(TrackId("x000"), { title: "Glory Elsewhere" });
    const api = mountPage(ref(null), ref("glory"));
    await until(() => api.tracks.value.length === 2);

    expect([...ids(api)].sort()).toEqual([TrackId("t005"), TrackId("t006")]);
    expect(api.trackCount.value).toBe(2);
    expect(api.albumData.value?.duration).toBe("common.minutesShort:3");

    const [track] = await getTracksByIds([TrackId("x000")]);
    await addTracksToAlbumAndSync(ALBUM, [track]);
    await until(() => ids(api).includes(TrackId("x000")));

    expect(api.trackCount.value).toBe(3);
    expect(api.albumData.value?.duration).toBe("common.minutesShort:13");
    expect(api.tracks.value.find(row => row.id === TrackId("x000"))?.albumName).toBe("Album");

    await db.tracks.update(TrackId("t006"), { title: "Sunny" });
    await until(() => api.tracks.value.find(row => row.id === TrackId("t006"))?.title === "Sunny");
    await syncSearchIndex({ tracks: [TrackId("t006")] });
    await until(() => !ids(api).includes(TrackId("t006")));

    expect([...ids(api)].sort()).toEqual([TrackId("t005"), TrackId("x000")]);
    expect(api.trackCount.value).toBe(2);
    expect(api.isError.value).toBe(false);
  });
});
