import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, watch, type EffectScope } from "vue";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { AlbumId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/types/track-sort";
import { useLiveTrackList, type LiveTrackListOptions } from "../useLiveTrackList";

const ALBUM = AlbumId("al1");

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

const name = (index: number) => `t${String(index).padStart(3, "0")}`;

// 120 album members t000..t119 and a shadow that would lead the title order if it counted.
const SEED: TrackEntity[] = [
  ...Array.from({ length: 120 }, (_, i) => entity(name(i))),
  entity("s000", { pinned: 0 }),
];

const ascending = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => TrackId(name(from + i)));

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useLiveTrackList", () => {
  let scope: EffectScope;
  const sort = ref<TrackSortKey>("title_asc");
  const read = vi.fn(async (limit: number) => trackRepository.inAlbum(ALBUM).members().rows({ sort: sort.value, limit }));

  const start = (overrides: Partial<LiveTrackListOptions> = {}) =>
    scope.run(() => useLiveTrackList({ read, deps: () => [sort.value], ...overrides }))!;

  const ids = (list: ReturnType<typeof useLiveTrackList>) => list.tracks.value.map(track => track.id);

  const failing = (fails: (limit: number) => boolean) => async (limit: number) => {
    if (fails(limit)) throw new Error(`read ${limit}`);
    return read(limit);
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
    sort.value = "title_asc";
    read.mockClear();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it("reads one page plus a probe row and cuts the probe before it reaches tracks", async () => {
    const list = start();
    expect(list.isLoading.value).toBe(true);
    expect(list.tracks.value).toEqual([]);

    await until(() => !list.isLoading.value);

    expect(ids(list)).toEqual(ascending(0, 50));
    expect(list.hasNextPage.value).toBe(true);
    expect(list.isError.value).toBe(false);
    expect(list.error.value).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(51);
  });

  it("fetchNextPage grows the list by one page per call and stops at the end", async () => {
    const list = start();
    await until(() => !list.isLoading.value);

    const growing = list.fetchNextPage();
    expect(list.isFetchingNextPage.value).toBe(true);
    expect(ids(list)).toEqual(ascending(0, 50));
    await growing;

    expect(list.isFetchingNextPage.value).toBe(false);
    expect(ids(list)).toEqual(ascending(0, 100));
    expect(list.hasNextPage.value).toBe(true);
    expect(read).toHaveBeenLastCalledWith(101);

    await list.fetchNextPage();

    expect(ids(list)).toEqual(ascending(0, 120));
    expect(list.hasNextPage.value).toBe(false);
    expect(read).toHaveBeenLastCalledWith(151);

    const reads = read.mock.calls.length;
    await list.fetchNextPage();
    await quiet();

    expect(read).toHaveBeenCalledTimes(reads);
    expect(ids(list)).toEqual(ascending(0, 120));
  });

  it("a write inside the loaded prefix re-emits the list at the same size", async () => {
    const list = start();
    await until(() => !list.isLoading.value);
    await list.fetchNextPage();

    await trackRepository.update(TrackId("t010"), { title: "zzz" });
    await until(() => !ids(list).includes(TrackId("t010")));

    expect(ids(list)).toEqual([...ascending(0, 10), ...ascending(11, 101)]);
    expect(list.hasNextPage.value).toBe(true);
    expect(read).toHaveBeenLastCalledWith(101);

    await trackRepository.create(entity("n000", { title: "a" }));
    await until(() => ids(list)[0] === TrackId("n000"));

    expect(list.tracks.value).toHaveLength(100);
    expect(read).toHaveBeenLastCalledWith(101);
  });

  it("a deps change resets the list to one page and keeps the old rows until the new read lands", async () => {
    const list = start();
    await until(() => !list.isLoading.value);
    await list.fetchNextPage();
    const before = ids(list);
    expect(before).toHaveLength(100);

    const shown: number[] = [];
    watch(list.tracks, tracks => shown.push(tracks.length), { flush: "sync" });

    sort.value = "title_desc";
    await nextTick();

    expect(ids(list)).toEqual(before);
    expect(list.isLoading.value).toBe(false);

    await until(() => ids(list)[0] === TrackId("t119"));

    expect(ids(list)).toEqual(ascending(70, 120).reverse());
    expect(list.hasNextPage.value).toBe(true);
    expect(read).toHaveBeenLastCalledWith(51);
    expect(shown.every(length => length > 0)).toBe(true);
  });

  it("a failed next page keeps the rows live, reports isFetchNextPageError, and a retry loads it", async () => {
    let fails = true;
    const list = start({ read: failing(limit => fails && limit > 51) });
    await until(() => !list.isLoading.value);

    await list.fetchNextPage();

    expect(ids(list)).toEqual(ascending(0, 50));
    expect(list.isFetchingNextPage.value).toBe(false);
    expect(list.isFetchNextPageError.value).toBe(true);
    expect(list.isError.value).toBe(false);
    expect(list.error.value).toEqual(new Error("read 101"));
    expect(list.hasNextPage.value).toBe(true);

    await quiet();
    await trackRepository.update(TrackId("t000"), { title: "zzz" });
    await until(() => ids(list)[0] === TrackId("t001"));

    expect(list.tracks.value).toHaveLength(50);
    expect(list.isError.value).toBe(false);
    expect(list.isFetchNextPageError.value).toBe(true);

    fails = false;
    await list.fetchNextPage();

    expect(ids(list)).toEqual(ascending(1, 101));
    expect(list.isFetchNextPageError.value).toBe(false);
    expect(list.error.value).toBeUndefined();
  });

  it("a failed first read reports isError and refetch reads again", async () => {
    let fails = true;
    const list = start({ read: failing(() => fails) });

    await until(() => list.isError.value);

    expect(list.error.value).toEqual(new Error("read 51"));
    expect(list.isLoading.value).toBe(false);
    expect(list.tracks.value).toEqual([]);
    expect(list.hasNextPage.value).toBe(false);

    fails = false;
    list.refetch();
    await until(() => list.tracks.value.length === 50);

    expect(list.isError.value).toBe(false);
    expect(list.error.value).toBeUndefined();
  });

  it("reads nothing while disabled and starts again from one page once enabled", async () => {
    const enabled = ref(false);
    const list = start({ enabled });
    await quiet();

    expect(read).not.toHaveBeenCalled();
    expect(list.isLoading.value).toBe(false);
    expect(list.tracks.value).toEqual([]);

    enabled.value = true;
    expect(list.isLoading.value).toBe(true);
    await until(() => !list.isLoading.value);
    await list.fetchNextPage();
    expect(list.tracks.value).toHaveLength(100);

    enabled.value = false;

    expect(list.tracks.value).toEqual([]);
    expect(list.hasNextPage.value).toBe(false);

    await trackRepository.create(entity("n000", { title: "a" }));
    enabled.value = true;
    await until(() => !list.isLoading.value);

    expect(ids(list)).toEqual([TrackId("n000"), ...ascending(0, 49)]);
    expect(read).toHaveBeenLastCalledWith(51);
  });
});
