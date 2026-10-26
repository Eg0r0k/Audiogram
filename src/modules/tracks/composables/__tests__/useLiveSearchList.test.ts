import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { resetSearchIndex, syncSearchIndex } from "@/services/search/searchIndex";
import { AlbumId, TrackId } from "@/types/ids";

vi.mock("@/queries/track.queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/queries/track.queries")>();
  return { ...actual, searchTrackIds: vi.fn(actual.searchTrackIds) };
});

import { searchTrackIds } from "@/queries/track.queries";
import { useLiveSearchList, type LiveSearchListOptions } from "../useLiveSearchList";

const ALBUM = AlbumId("al1");
const OTHER = AlbumId("al2");

const entity = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [],
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

const name = (index: number) => `s${String(index).padStart(3, "0")}`;

// 120 "Song" tracks s000..s119 in another album, three "Alpha" tracks (one of them in the other album) and one unrelated.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 120 }, (_, i) => entity(name(i), { title: `Song ${name(i)}`, albumId: OTHER })),
  entity("a1", { title: "Alpha One" }),
  entity("a2", { title: "Alpha Two" }),
  entity("a3", { title: "Alpha Three", albumId: OTHER }),
  entity("b1", { title: "Beta" }),
];

const songs = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => TrackId(name(from + i)));

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useLiveSearchList", () => {
  let scope: EffectScope;

  const start = (overrides: Partial<LiveSearchListOptions> = {}) =>
    scope.run(() => useLiveSearchList({ query: () => "alpha", sort: () => null, ...overrides }))!;

  type List = ReturnType<typeof useLiveSearchList>;

  const ids = (list: List) => list.list.value?.tracks.map(track => track.id) ?? [];

  const idSet = (list: List) => [...ids(list)].sort();

  const row = (list: List, id: string) => list.list.value?.tracks.find(track => track.id === id);

  const loaded = (list: List) => until(() => list.list.value !== undefined);

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
    resetSearchIndex();
    vi.mocked(searchTrackIds).mockClear();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.restoreAllMocks();
  });

  it("re-runs the search when the index changes and keeps the rows live", async () => {
    const list = start();
    expect(list.isLoading.value).toBe(true);
    await loaded(list);

    expect(idSet(list)).toEqual(["a1", "a2", "a3"]);
    expect(list.list.value?.total).toBe(3);
    expect(list.list.value?.totalDuration).toBe(300);
    expect(Object.keys(list.list.value?.matches ?? {}).sort()).toEqual(["a1", "a2", "a3"]);
    expect(list.isLoading.value).toBe(false);
    expect(list.hasNextPage.value).toBe(false);
    expect(searchTrackIds).toHaveBeenCalledTimes(1);

    await db.tracks.update(TrackId("a1"), { duration: 250 });
    await until(() => row(list, "a1")?.duration === 250);
    await quiet();

    expect(searchTrackIds).toHaveBeenCalledTimes(1);

    await db.tracks.add(entity("a4", { title: "Alpha Four" }));
    await quiet();

    expect(ids(list)).not.toContain(TrackId("a4"));

    await syncSearchIndex({ tracks: [TrackId("a4")] });
    await until(() => ids(list).includes(TrackId("a4")));

    expect(idSet(list)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(list.list.value?.total).toBe(4);
    expect(list.list.value?.matches[TrackId("a4")]).toBeDefined();
    expect(row(list, "a1")?.duration).toBe(250);
    expect(searchTrackIds).toHaveBeenCalledTimes(2);
    expect(list.isError.value).toBe(false);
  });

  it("a track renamed out of the query leaves the list on the next index sync", async () => {
    const list = start();
    await loaded(list);

    await db.tracks.update(TrackId("a2"), { title: "Gamma Two" });
    await until(() => row(list, "a2")?.title === "Gamma Two");
    await quiet();

    expect(idSet(list)).toEqual(["a1", "a2", "a3"]);

    await syncSearchIndex({ tracks: [TrackId("a2")] });
    await until(() => !ids(list).includes(TrackId("a2")));

    expect(idSet(list)).toEqual(["a1", "a3"]);
    expect(list.list.value?.total).toBe(2);
    expect(list.list.value?.matches[TrackId("a2")]).toBeUndefined();
  });

  it("a sort orders every hit before the slice, and an index change keeps the loaded size", async () => {
    const list = start({ query: () => "song", sort: () => "title_asc" });
    await loaded(list);

    expect(ids(list)).toEqual(songs(0, 50));
    expect(list.list.value?.total).toBe(120);
    expect(list.hasNextPage.value).toBe(true);

    const growing = list.fetchNextPage();
    expect(list.isFetchingNextPage.value).toBe(true);
    await growing;

    expect(list.isFetchingNextPage.value).toBe(false);
    expect(ids(list)).toEqual(songs(0, 100));

    await db.tracks.add(entity("s0505", { title: "Song s0505", albumId: OTHER }));
    await syncSearchIndex({ tracks: [TrackId("s0505")] });
    await until(() => ids(list).includes(TrackId("s0505")));

    expect(ids(list)).toEqual([...songs(0, 51), TrackId("s0505"), ...songs(51, 99)]);
    expect(list.list.value?.total).toBe(121);
    expect(list.hasNextPage.value).toBe(true);

    await list.fetchNextPage();
    await list.fetchNextPage();

    expect(ids(list)).toHaveLength(121);
    expect(list.hasNextPage.value).toBe(false);
  });

  it("a collection search follows its live id set without an index sync", async () => {
    const list = start({ within: async () => trackRepository.inAlbum(ALBUM).ids() });
    await loaded(list);

    expect(idSet(list)).toEqual(["a1", "a2"]);
    expect(list.list.value?.total).toBe(2);
    expect(list.list.value?.totalDuration).toBe(200);

    await db.tracks.update(TrackId("a3"), { albumId: ALBUM });
    await until(() => ids(list).includes(TrackId("a3")));

    expect(idSet(list)).toEqual(["a1", "a2", "a3"]);
    expect(list.list.value?.total).toBe(3);

    await db.tracks.update(TrackId("a1"), { albumId: OTHER });
    await until(() => !ids(list).includes(TrackId("a1")));

    expect(idSet(list)).toEqual(["a2", "a3"]);
  });

  it("a failed search is an error until refetch searches again", async () => {
    const failure = new Error("index");
    vi.mocked(searchTrackIds).mockRejectedValueOnce(failure);
    const list = start();
    await until(() => list.isError.value);

    expect(list.error.value).toBe(failure);
    expect(list.isLoading.value).toBe(false);
    expect(list.list.value).toBeUndefined();

    list.refetch();
    await loaded(list);

    expect(list.isError.value).toBe(false);
    expect(idSet(list)).toEqual(["a1", "a2", "a3"]);
  });

  it("a disabled list neither searches nor follows the index", async () => {
    const list = start({ enabled: false });
    await quiet();
    await syncSearchIndex({ tracks: [TrackId("a1")] });
    await quiet();

    expect(searchTrackIds).not.toHaveBeenCalled();
    expect(list.isLoading.value).toBe(false);
    expect(list.list.value).toBeUndefined();
  });
});
