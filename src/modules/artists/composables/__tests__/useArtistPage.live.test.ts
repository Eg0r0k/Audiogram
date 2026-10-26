import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type AlbumEntity, type ArtistEntity, type TrackEntity } from "@/db/entities";
import { TrackScope } from "@/db/repositories/track.scope";
import { createAlbumAndSync } from "@/queries/album.queries";
import { getArtistPageData, updateArtistAndSync } from "@/queries/artist.queries";
import { deleteTracksAndSync } from "@/queries/track.queries";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/modules/tracks/types";

const routing = vi.hoisted(() => ({ route: { params: {}, query: {} } as { params: { id?: string }; query: object } }));
vi.mock("vue-router", async () => {
  const { reactive } = await import("vue");
  routing.route = reactive({ params: { id: "ar1" }, query: {} });
  return { useRoute: () => routing.route, useRouter: () => ({ push: vi.fn(async () => undefined) }) };
});
vi.mock("@/modules/covers/composables/useEntityCover", async () => {
  const { ref } = await import("vue");
  return { useEntityCover: () => ({ url: ref(null), isLoading: ref(false) }) };
});

import { useArtistPage } from "../useArtistPage";

const ARTIST = ArtistId("ar1");
const OTHER = ArtistId("ar2");

const ARTIST_ROW: ArtistEntity = { id: ARTIST, name: "Artist", pinned: 1, addedAt: 1, updatedAt: 1 };

const album = (id: string, overrides: Partial<AlbumEntity> = {}): AlbumEntity => ({
  id: AlbumId(id),
  title: id,
  artistId: ARTIST,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const entity = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "Artist",
  albumTitle: "al1",
  artistIds: [ARTIST],
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

// 60 artist members t000..t059 added in that order, every third one titled "zz"; a shadow and another artist's track would lead the id order if they counted.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 60 }, (_, i) => entity(name(i), { title: i % 3 === 0 ? "zz" : name(i), addedAt: 1000 + i })),
  entity("s000", { pinned: 0 }),
  entity("o000", { artistIds: [OTHER], artistName: "Other", albumId: AlbumId("al3"), albumTitle: "al3" }),
];

const ascending = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => TrackId(name(from + i)));

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useArtistPage on live reads", () => {
  let queryClient: QueryClient;
  // The mutations patch a client the page does not read, so only a live read can show their writes.
  let writer: QueryClient;
  let wrapper: VueWrapper | undefined;

  const mountPage = (sortKey: Ref<TrackSortKey | null> = ref(null), searchQuery = ref("")) => {
    let api!: ReturnType<typeof useArtistPage>;
    wrapper = mount(
      defineComponent({
        setup() {
          api = useArtistPage(sortKey, searchQuery);
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );
    return api;
  };

  const ids = (api: ReturnType<typeof useArtistPage>) => api.tracks.value.map(track => track.id);

  const albumIds = (api: ReturnType<typeof useArtistPage>) => api.albums.value.map(row => row.id);

  const loaded = async (api: ReturnType<typeof useArtistPage>) => {
    await until(() => !api.isLoading.value);
    await quiet();
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.bulkAdd([ARTIST_ROW, { ...ARTIST_ROW, id: OTHER, name: "Other" }]);
    await db.albums.bulkAdd([
      album("al1", { year: 2001 }),
      album("al2", { year: 2005 }),
      album("al3", { artistId: OTHER, year: 2010 }),
      album("al4", { pinned: 0, year: 2020 }),
    ]);
    await db.tracks.bulkAdd(SEED);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    writer = new QueryClient();
    routing.route.params.id = "ar1";
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it("artist: a new album of the artist appears on the shelf", async () => {
    const api = mountPage();
    await loaded(api);
    expect(albumIds(api)).toEqual([AlbumId("al2"), AlbumId("al1")]);
    expect(api.albumCount.value).toBe(2);
    expect(api.hasNextAlbumPage.value).toBe(false);

    const created = await createAlbumAndSync(writer, ARTIST, "Fresh");
    await until(() => api.albums.value.length === 3);

    expect(albumIds(api)).toContain(created.id);
    expect(api.albums.value.find(row => row.id === created.id)?.title).toBe("Fresh");
    expect(api.albumCount.value).toBe(3);
    expect(api.hasNextAlbumPage.value).toBe(false);
    expect(api.isError.value).toBe(false);
  });

  it("artist: a track that leaves the library disappears from the list", async () => {
    const api = mountPage();
    await loaded(api);
    expect(ids(api)).toEqual(ascending(0, 50));
    expect(api.trackCount.value).toBe(60);
    expect(api.hasNextTrackPage.value).toBe(true);

    await deleteTracksAndSync(writer, [TrackId(name(0))]);
    await until(() => ids(api)[0] === TrackId(name(1)));
    await until(() => api.trackCount.value === 59);
    expect(ids(api)).toEqual(ascending(1, 51));

    await db.tracks.update(TrackId(name(1)), { pinned: 0 });
    await until(() => ids(api)[0] === TrackId(name(2)));
    await until(() => api.trackCount.value === 58);
    expect(ids(api)).toEqual(ascending(2, 52));
    expect(api.isError.value).toBe(false);
  });

  it("artist: the header follows a rename", async () => {
    const api = mountPage();
    await loaded(api);
    expect(api.artist.value?.name).toBe("Artist");
    expect(api.artistData.value?.title).toBe("Artist");

    await updateArtistAndSync(writer, ARTIST_ROW, { name: "Renamed" });
    await until(() => api.artist.value?.name === "Renamed");
    await until(() => api.tracks.value[0]?.artist === "Renamed");

    expect(api.artistData.value?.title).toBe("Renamed");
    expect(api.tracks.value.every(track => track.artist === "Renamed")).toBe(true);
    expect(api.isError.value).toBe(false);
  });

  it("artist: a sorted list keeps the order the queue plays", async () => {
    const api = mountPage(ref<TrackSortKey | null>("title_desc"));
    await loaded(api);
    const queued = (await getArtistPageData(ARTIST, "title_desc")).tracks.map(track => track.id);

    expect(ids(api)).toEqual(queued.slice(0, 50));
    expect(ids(api).slice(0, 3)).toEqual([TrackId(name(0)), TrackId(name(3)), TrackId(name(6))]);
  });

  it("artist: a page sliding out keeps its artist when the route moves on", async () => {
    const api = mountPage();
    await loaded(api);
    const before = ids(api);
    const rows = vi.spyOn(TrackScope.prototype, "rows");

    routing.route.params.id = "al1";
    await quiet();

    expect(api.isError.value).toBe(false);
    expect(api.isLoading.value).toBe(false);
    expect(api.artist.value?.id).toBe(ARTIST);
    expect(ids(api)).toEqual(before);
    expect(albumIds(api)).toEqual([AlbumId("al2"), AlbumId("al1")]);
    expect(rows).not.toHaveBeenCalled();
  });
});
