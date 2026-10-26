import "fake-indexeddb/auto";
import { liveQuery, type Subscription } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { effectScope, ref, watch, type EffectScope, type Ref } from "vue";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories/track.repository";
import { AlbumId, TrackId } from "@/types/ids";
import { useLiveQuery, type UseLiveQueryOptions } from "../useLiveQuery";

const track = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [],
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

// Three members, two liked rows (one of them a shadow).
const SEED: TrackEntity[] = [
  track("m1", { likedAt: 10 }),
  track("m2"),
  track("m3"),
  track("s1", { pinned: 0, likedAt: 20 }),
];

type Subscribe = (...args: unknown[]) => Subscription;

const observableProto = Object.getPrototypeOf(liveQuery(() => 0)) as { subscribe: Subscribe };

const nextEmission = <T>(source: Readonly<Ref<T>>): Promise<T> =>
  new Promise((resolve) => {
    const stop = watch(source, (value) => {
      stop();
      resolve(value);
    }, { flush: "sync" });
  });

const membersCount = () => trackRepository.members().count();

describe("useLiveQuery", () => {
  let scope: EffectScope;
  let subscribe: MockInstance<Subscribe>;

  const start = <T>(querier: () => Promise<T> | T, deps: () => unknown[] = () => [], options?: UseLiveQueryOptions) =>
    scope.run(() => useLiveQuery(querier, deps, options))!;

  const subscriptionAt = (index: number) => subscribe.mock.results[index]?.value as Subscription;

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd(SEED);
    subscribe = vi.spyOn(observableProto, "subscribe");
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.restoreAllMocks();
  });

  it("emits the querier result and updates after a write", async () => {
    const live = start(membersCount);
    expect(live.isLoading.value).toBe(true);
    expect(live.data.value).toBeUndefined();

    expect(await nextEmission(live.data)).toBe(3);
    expect(live.isLoading.value).toBe(false);

    const updated = nextEmission(live.data);
    await trackRepository.create(track("m4"));

    expect(await updated).toBe(4);
    expect(live.error.value).toBeUndefined();
    expect(live.isStale.value).toBe(false);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous data until the new querier emits when deps change", async () => {
    const liked = ref(false);
    const live = start(
      () => (liked.value ? trackRepository.liked().count() : membersCount()),
      () => [liked.value],
    );
    expect(await nextEmission(live.data)).toBe(3);
    expect(live.isStale.value).toBe(false);

    liked.value = true;

    expect(live.isStale.value).toBe(true);
    expect(live.data.value).toBe(3);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(subscriptionAt(0).closed).toBe(true);

    expect(await nextEmission(live.data)).toBe(2);
    expect(live.isStale.value).toBe(false);
    expect(live.isLoading.value).toBe(false);
  });

  it("exposes a thrown error through error, keeps the last data, and refetch subscribes again", async () => {
    const boom = new Error("boom");
    let failing = false;
    const live = start(async () => {
      const count = await membersCount();
      if (failing) throw boom;
      return count;
    });
    expect(await nextEmission(live.data)).toBe(3);

    failing = true;
    const failed = nextEmission(live.error);
    await trackRepository.create(track("m4"));

    expect(await failed).toBe(boom);
    expect(live.data.value).toBe(3);
    expect(live.isStale.value).toBe(false);
    expect(live.isLoading.value).toBe(false);
    expect(subscriptionAt(0).closed).toBe(true);

    failing = false;
    live.refetch();

    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(await nextEmission(live.data)).toBe(4);
    expect(live.error.value).toBeUndefined();
  });

  it("unsubscribes on scope dispose", async () => {
    const querier = vi.fn(membersCount);
    const live = start(querier);
    expect(await nextEmission(live.data)).toBe(3);
    const unsubscribe = vi.spyOn(subscriptionAt(0), "unsubscribe");

    const witnessScope = effectScope();
    const witness = witnessScope.run(() => useLiveQuery(membersCount, () => []))!;
    expect(await nextEmission(witness.data)).toBe(3);

    scope.stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    const runs = querier.mock.calls.length;

    const witnessed = nextEmission(witness.data);
    await trackRepository.create(track("m4"));

    expect(await witnessed).toBe(4);
    expect(querier).toHaveBeenCalledTimes(runs);
    expect(live.data.value).toBe(3);
    witnessScope.stop();
  });

  it("does not subscribe while enabled is false and subscribes once it turns true", async () => {
    const enabled = ref(false);
    const querier = vi.fn(membersCount);
    const live = start(querier, () => [], { enabled });

    expect(subscribe).not.toHaveBeenCalled();
    live.refetch();
    expect(subscribe).not.toHaveBeenCalled();
    expect(live.isLoading.value).toBe(true);

    enabled.value = true;

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(await nextEmission(live.data)).toBe(3);
    expect(live.isLoading.value).toBe(false);

    enabled.value = false;

    expect(subscriptionAt(0).closed).toBe(true);
    expect(live.data.value).toBe(3);
  });

  it("keeps reads after an await observed when the querier is a plain arrow", async () => {
    const titles = async () => {
      const ids = await trackRepository.members().ids();
      return (await trackRepository.findByIds(ids)).map(row => row.title).sort();
    };
    const live = start(() => titles());
    expect(await nextEmission(live.data)).toEqual(["m1", "m2", "m3"]);

    const renamed = nextEmission(live.data);
    await trackRepository.update(TrackId("m2"), { title: "x2" });

    expect(await renamed).toEqual(["m1", "m3", "x2"]);
  });

  it("reports a synchronous throw through error", async () => {
    const boom = new Error("sync");
    const live = start((): number => {
      throw boom;
    });

    expect(await nextEmission(live.error)).toBe(boom);
    expect(live.isLoading.value).toBe(true);
    expect(live.data.value).toBeUndefined();
    expect(subscriptionAt(0).closed).toBe(true);
  });
});
