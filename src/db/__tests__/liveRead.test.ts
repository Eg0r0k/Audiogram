import "fake-indexeddb/auto";
import Dexie, { liveQuery, type ObservabilitySet, type Subscription } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { trackRepository } from "@/db/repositories";
import { AlbumId, TrackId } from "@/types/ids";
import { liveRead } from "../liveRead";

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

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

type Subscribe = (...args: unknown[]) => Subscription;
type MutationListener = (parts: ObservabilitySet) => unknown;

const observableProto = Object.getPrototypeOf(liveQuery(() => 0)) as { subscribe: Subscribe };

const memberIds = () => trackRepository.members().ids();

// Reads first and waits after, so a write committed during the wait is one the read did not see.
// A promise resolved inside a querier pulls whoever awaits it into Dexie's liveQuery zone, where a write throws.
const gatedRead = () => {
  const gate = deferred();
  let hasRead = false;
  const querier = vi.fn(async () => {
    const ids = await memberIds();
    hasRead = true;
    await gate.promise;
    return ids;
  });
  const reading = () => vi.waitFor(() => expect(hasRead).toBe(true));
  return { querier, reading, release: gate.resolve };
};

describe("liveRead", () => {
  let subscribe: MockInstance<Subscribe>;
  let listen: MockInstance<(listener: MutationListener) => void>;
  let unlisten: MockInstance<(listener: MutationListener) => void>;
  let active: Subscription | undefined;

  const follow = (querier: () => Promise<TrackId[]>) => {
    const values: TrackId[][] = [];
    const subscription = liveRead(querier).subscribe({ next: value => values.push(value) });
    active = subscription;
    return { values, subscription };
  };

  const ownListener = () => listen.mock.calls[0]?.[0];

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.tracks.bulkAdd([track("m1"), track("m2"), track("m3")]);
    subscribe = vi.spyOn(observableProto, "subscribe");
    listen = vi.spyOn(Dexie.on.storagemutated, "subscribe");
    unlisten = vi.spyOn(Dexie.on.storagemutated, "unsubscribe");
  });

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
    vi.restoreAllMocks();
  });

  it("a write committed during the first run shows up in the emission", async () => {
    const { querier, reading, release } = gatedRead();
    const { values } = follow(querier);

    await reading();
    await trackRepository.create(track("m4"));
    release();

    await vi.waitFor(() => expect(values.at(-1)).toContain(TrackId("m4")));
    await quiet();

    expect(values.length).toBeLessThanOrEqual(2);
    expect(values.at(-1)).toHaveLength(4);
    expect(subscribe.mock.results.filter(result => !(result.value as Subscription).closed)).toHaveLength(1);
  });

  it("without a write during the first run it emits once", async () => {
    const querier = vi.fn(memberIds);
    const { values } = follow(querier);

    await vi.waitFor(() => expect(values).toHaveLength(1));
    await quiet();

    expect(values).toHaveLength(1);
    expect(querier).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(ownListener()).toBeDefined();
    expect(unlisten).toHaveBeenCalledWith(ownListener());

    await trackRepository.create(track("m4"));
    await vi.waitFor(() => expect(values).toHaveLength(2));
    await quiet();

    expect(values).toHaveLength(2);
    expect(values[1]).toContain(TrackId("m4"));
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe during the first run stops everything", async () => {
    const { querier, reading, release } = gatedRead();
    const { values, subscription } = follow(querier);
    await reading();
    const listener = ownListener();

    subscription.unsubscribe();
    await trackRepository.create(track("m4"));
    release();
    await quiet();
    await trackRepository.create(track("m5"));
    await quiet();

    expect(values).toEqual([]);
    expect(querier).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
    expect(subscribe.mock.results.every(result => (result.value as Subscription).closed)).toBe(true);
    expect(listener).toBeDefined();
    expect(unlisten).toHaveBeenCalledWith(listener);
  });
});
