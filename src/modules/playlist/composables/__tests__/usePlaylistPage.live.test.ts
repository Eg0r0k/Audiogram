import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState, type PlaylistEntity, type TrackEntity } from "@/db/entities";
import { playlistRepository } from "@/db/repositories";
import { TrackScope } from "@/db/repositories/track.scope";
import { resetSearchIndex, syncSearchIndex } from "@/services/search/searchIndex";
import { addTracksToPlaylistAndSync, removeTrackFromPlaylistWithUndo } from "@/queries/playlist.queries";
import { deleteTracksAndSync, getTracksByIds } from "@/queries/track.queries";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/modules/tracks/types";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: { count?: number }) => (params ? `${key}:${params.count}` : key) }),
}));
const routing = vi.hoisted(() => ({ route: { params: {}, query: {} } as { params: { id?: string }; query: object } }));
vi.mock("vue-router", async () => {
  const { reactive } = await import("vue");
  routing.route = reactive({ params: { id: "p1" }, query: {} });
  return { useRoute: () => routing.route, useRouter: () => ({ push: vi.fn(async () => undefined) }) };
});
vi.mock("@/modules/covers/composables/useEntityCover", async () => {
  const { ref } = await import("vue");
  return { useEntityCover: () => ({ url: ref(null), isLoading: ref(false) }) };
});

import { usePlaylistPage } from "../usePlaylistPage";

const PLAYLIST = PlaylistId("p1");
const ARTIST = ArtistId("ar1");
const ALBUM = AlbumId("al1");

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

// The playlist holds t000..t059 in a stride-7 order, so neither the id nor the title order is the list order.
const ORDER = Array.from({ length: 60 }, (_, i) => TrackId(name((i * 7) % 60)));

const PLAYLIST_ROW: PlaylistEntity = { id: PLAYLIST, name: "Playlist", trackIds: ORDER, addedAt: 1, updatedAt: 1 };

const SEED: TrackEntity[] = [
  ...Array.from({ length: 60 }, (_, i) => entity(name(i))),
  entity("x000", { duration: 600 }),
];

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("usePlaylistPage on live reads", () => {
  let queryClient: QueryClient;
  let wrapper: VueWrapper | undefined;

  const mountPage = (sortKey: Ref<TrackSortKey | null> = ref(null), searchQuery = ref("")) => {
    let api!: ReturnType<typeof usePlaylistPage>;
    wrapper = mount(
      defineComponent({
        setup() {
          api = usePlaylistPage(sortKey, searchQuery);
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );
    return api;
  };

  const ids = (api: ReturnType<typeof usePlaylistPage>) => api.tracks.value.map(track => track.id);

  const loaded = async (api: ReturnType<typeof usePlaylistPage>) => {
    await until(() => !api.isLoading.value);
    await quiet();
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.add({ id: ARTIST, name: "Artist", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.albums.add({ id: ALBUM, title: "Album", artistId: ARTIST, pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.tracks.bulkAdd(SEED);
    await db.playlists.add(PLAYLIST_ROW);
    resetSearchIndex();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    routing.route.params.id = "p1";
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it("playlist: adding a track to the playlist appears in the list in place", async () => {
    const api = mountPage();
    await loaded(api);
    expect(ids(api)).toEqual(ORDER.slice(0, 50));
    expect(api.trackCount.value).toBe(60);
    expect(api.totalDuration.value).toBe("common.hoursShort:1 common.minutesShort:40");
    expect(api.hasNextPage.value).toBe(true);
    const rows = vi.spyOn(TrackScope.prototype, "rows");

    const [track] = await getTracksByIds([TrackId("x000")]);
    await addTracksToPlaylistAndSync(queryClient, PLAYLIST, [track]);
    await until(() => api.trackCount.value === 61);
    await until(() => api.totalDuration.value === "common.hoursShort:1 common.minutesShort:50");
    await until(() => rows.mock.calls.length > 0);

    expect(ids(api)).toEqual(ORDER.slice(0, 50));
    expect(api.playlistData.value?.trackCount).toBe(61);

    await api.fetchNextPage();

    expect(ids(api)).toEqual([...ORDER, TrackId("x000")]);
    expect(api.hasNextPage.value).toBe(false);

    const { restore } = await removeTrackFromPlaylistWithUndo(queryClient, PLAYLIST, ORDER[3]);
    await until(() => !ids(api).includes(ORDER[3]));
    await restore();
    await until(() => ids(api)[3] === ORDER[3]);

    expect(ids(api)).toEqual([...ORDER, TrackId("x000")]);
    expect(api.isError.value).toBe(false);
  });

  it("playlist: a reorder re-emits the list in the new order", async () => {
    const api = mountPage();
    await loaded(api);
    expect(ids(api)).toEqual(ORDER.slice(0, 50));

    const reversed = [...ORDER].reverse();
    await playlistRepository.reorderTracks(PLAYLIST, reversed);
    await until(() => ids(api)[0] === reversed[0]);

    expect(ids(api)).toEqual(reversed.slice(0, 50));
    expect(api.trackCount.value).toBe(60);
    expect(api.hasNextPage.value).toBe(true);
    expect(api.isError.value).toBe(false);
  });

  it("playlist: deleting a track from the library drops it from the list", async () => {
    const api = mountPage();
    await loaded(api);
    expect(ids(api)).toContain(ORDER[2]);

    await deleteTracksAndSync(queryClient, [ORDER[2]]);
    await until(() => !ids(api).includes(ORDER[2]));
    await until(() => api.trackCount.value === 59);

    expect(ids(api)).toEqual(ORDER.filter((_, index) => index !== 2).slice(0, 50));
    expect(api.totalDuration.value).toBe("common.hoursShort:1 common.minutesShort:38");
    expect(api.hasNextPage.value).toBe(true);
    expect(api.isError.value).toBe(false);
  });

  it("playlist: editing a track re-reads its row in place", async () => {
    const api = mountPage();
    await loaded(api);

    await db.tracks.update(ORDER[4], { title: "Edited" });
    await until(() => api.tracks.value[4]?.title === "Edited");

    expect(ids(api)).toEqual(ORDER.slice(0, 50));
  });

  it("playlist: a sort orders every track of the playlist before the cut", async () => {
    const api = mountPage(ref<TrackSortKey | null>("title_desc"));
    await loaded(api);

    expect(ids(api)).toEqual(Array.from({ length: 50 }, (_, i) => TrackId(name(59 - i))));
    expect(api.hasNextPage.value).toBe(true);
  });

  it("playlist: an id without a track row is skipped and the next id fills the page", async () => {
    await db.playlists.update(PLAYLIST, { trackIds: [...ORDER.slice(0, 10), TrackId("gone"), ...ORDER.slice(10)] });
    const api = mountPage();
    await loaded(api);

    expect(ids(api)).toEqual(ORDER.slice(0, 50));
    expect(api.hasNextPage.value).toBe(true);

    await api.fetchNextPage();

    expect(ids(api)).toEqual(ORDER);
    expect(api.hasNextPage.value).toBe(false);
  });

  it("playlist: a page sliding out keeps its playlist when the route moves on", async () => {
    const api = mountPage();
    await loaded(api);
    const before = ids(api);
    const rows = vi.spyOn(TrackScope.prototype, "rows");

    routing.route.params.id = "al1";
    await quiet();

    expect(api.isError.value).toBe(false);
    expect(api.isLoading.value).toBe(false);
    expect(api.playlist.value?.id).toBe(PLAYLIST);
    expect(ids(api)).toEqual(before);
    expect(rows).not.toHaveBeenCalled();
  });

  it("playlist: a search string reads live rows and follows the index", async () => {
    const writer = new QueryClient();
    await db.tracks.update(TrackId("t005"), { title: "Glory Box" });
    await db.tracks.update(TrackId("t006"), { title: "Glory Days" });
    await db.tracks.update(TrackId("x000"), { title: "Glory Extra" });
    const api = mountPage(ref(null), ref("glory"));
    await until(() => api.tracks.value.length === 2);

    expect([...ids(api)].sort()).toEqual([TrackId("t005"), TrackId("t006")]);
    expect(api.trackCount.value).toBe(2);
    expect(api.totalDuration.value).toBe("common.minutesShort:3");

    const [track] = await getTracksByIds([TrackId("x000")]);
    await addTracksToPlaylistAndSync(writer, PLAYLIST, [track]);
    await until(() => ids(api).includes(TrackId("x000")));

    expect(api.trackCount.value).toBe(3);
    expect(api.totalDuration.value).toBe("common.minutesShort:13");

    await removeTrackFromPlaylistWithUndo(writer, PLAYLIST, TrackId("t005"));
    await until(() => !ids(api).includes(TrackId("t005")));

    await db.tracks.update(TrackId("t006"), { title: "Sunny" });
    await until(() => api.tracks.value.find(row => row.id === TrackId("t006"))?.title === "Sunny");
    await syncSearchIndex({ tracks: [TrackId("t006")] });
    await until(() => !ids(api).includes(TrackId("t006")));

    expect(ids(api)).toEqual([TrackId("x000")]);
    expect(api.trackCount.value).toBe(1);
    expect(api.totalDuration.value).toBe("common.minutesShort:10");
    expect(api.isError.value).toBe(false);
  });
});
