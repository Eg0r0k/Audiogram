import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import type { Counters } from "@/db/counters";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { unitOfWork } from "@/db/unit-of-work";
import { AlbumId, TrackId } from "@/types/ids";
import { counterRepository } from "../counter.repository";
import { trackRepository } from "../track.repository";

const M1 = TrackId("m1");
const M2 = TrackId("m2");
const M3 = TrackId("m3");
const S1 = TrackId("s1");
const S2 = TrackId("s2");

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

const SEED: TrackEntity[] = [
  track("m1", { duration: 100, likedAt: 10 }),
  track("m2", { duration: 200 }),
  track("m3", { duration: 300 }),
  track("s1", { duration: 400, likedAt: 20, pinned: 0 }),
  track("s2", { duration: 500, pinned: 0 }),
];

const counted = (likedCount: number, seconds: number, members: number): Counters => ({
  liked: { id: "liked", count: likedCount, seconds },
  members: { id: "members", count: members, seconds: 0 },
});

// Recounted from the rows, independent of the code under test.
const recount = async (): Promise<Counters> => {
  const rows = await db.tracks.toArray();
  const liked = rows.filter(row => (row.likedAt ?? 0) > 0);
  return counted(liked.length, liked.reduce((sum, row) => sum + row.duration, 0), rows.filter(row => row.pinned === 1).length);
};

const reset = async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await db.tracks.bulkAdd(SEED);
  const { liked, members } = await recount();
  await db.counters.bulkPut([liked, members]);
};

const liked = () => counterRepository.get("liked");
const members = async () => (await counterRepository.get("members")).count;

const LIKE_AND_UNLIKE: [string, () => Promise<unknown>, () => Promise<unknown>][] = [
  ["setLiked", () => trackRepository.setLiked(M2, true), () => trackRepository.setLiked(M2, false)],
  ["toggleLiked", () => trackRepository.toggleLiked(M2, false), () => trackRepository.toggleLiked(M2, true)],
  ["likeMany / unlikeMany", () => trackRepository.likeMany([M1, M2], 30), () => trackRepository.unlikeMany([M2, M3])],
  ["update", () => trackRepository.update(M2, { likedAt: 30 }), () => trackRepository.update(M2, { likedAt: undefined })],
  [
    "updateMany",
    () => trackRepository.updateMany([{ key: M2, changes: { likedAt: 30 } }, { key: M3, changes: { title: "Renamed" } }]),
    () => trackRepository.updateMany([{ key: M2, changes: { likedAt: undefined } }]),
  ],
  ["upsert", () => trackRepository.upsert({ ...SEED[1], likedAt: 30 }), () => trackRepository.upsert(SEED[1])],
  [
    "modify on a liked scope",
    () => trackRepository.withIds([M2]).modify((row) => { row.likedAt = 30; }),
    () => trackRepository.liked().modify((row) => { if (row.id === M2) delete row.likedAt; }),
  ],
  [
    "modify with an update spec",
    () => trackRepository.withIds([M2]).modify({ likedAt: 30 }),
    () => trackRepository.liked().members().modify({ likedAt: undefined }).then(() => trackRepository.setLiked(M1, true)),
  ],
];

beforeEach(async () => {
  await db.open();
  await reset();
});

describe("track counters", () => {
  it("liking and unliking through every write method moves the liked counter and its seconds", async () => {
    for (const [name, like, unlike] of LIKE_AND_UNLIKE) {
      await reset();

      await like();
      expect(await liked(), name).toEqual({ id: "liked", count: 3, seconds: 700 });
      expect(await counterRepository.getAll(), name).toEqual(await recount());

      await unlike();
      expect(await liked(), name).toEqual({ id: "liked", count: 2, seconds: 500 });
      expect(await counterRepository.getAll(), name).toEqual(await recount());
    }

    await trackRepository.update(M1, { duration: 160 });
    expect(await liked()).toEqual({ id: "liked", count: 2, seconds: 560 });
    await trackRepository.update(M2, { duration: 260 });
    expect(await liked()).toEqual({ id: "liked", count: 2, seconds: 560 });
  });

  it("creating, deleting and pinning rows moves the member counter", async () => {
    await trackRepository.create(track("n1"));
    await trackRepository.create(track("n2", { pinned: 0 }));
    expect(await members()).toBe(4);

    await trackRepository.createMany([track("n3"), track("n4", { pinned: 0, likedAt: 5, duration: 50 })]);
    expect(await members()).toBe(5);
    expect(await liked()).toEqual({ id: "liked", count: 3, seconds: 550 });

    await trackRepository.update(S2, { pinned: 1 });
    await trackRepository.updateMany([{ key: M1, changes: { pinned: 0 } }, { key: TrackId("n2"), changes: { pinned: 1 } }]);
    expect(await members()).toBe(6);

    await trackRepository.upsertMany([{ ...SEED[0], pinned: 1 }, track("n5")]);
    expect(await members()).toBe(8);
    expect(await liked()).toEqual({ id: "liked", count: 3, seconds: 550 });

    await trackRepository.delete(M2);
    await trackRepository.deleteMany([M3, S1, TrackId("missing"), M3]);
    expect(await members()).toBe(6);
    expect(await liked()).toEqual({ id: "liked", count: 2, seconds: 150 });
    expect(await counterRepository.getAll()).toEqual(await recount());
  });

  it("a transaction that fails after a counter adjustment rolls the counter back", async () => {
    const before = await counterRepository.getAll();
    let inside: Counters | undefined;

    const failure = await unitOfWork.run(["tracks", "counters"], async (uow) => {
      await uow.tracks.setLiked(M2, true);
      await uow.tracks.create(track("n1"));
      inside = await uow.counters.getAll();
      throw new Error("roll back");
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DbError);
    expect(inside).toEqual(counted(3, 700, 4));
    expect(await counterRepository.getAll()).toEqual(before);
    expect((await db.tracks.get(M2))?.likedAt).toBeUndefined();
    expect(await db.tracks.get(TrackId("n1"))).toBeUndefined();
  });

  it("rebuild recomputes both rows from the tracks table", async () => {
    await db.counters.clear();
    expect(await counterRepository.getAll()).toEqual(counted(0, 0, 0));

    await db.tracks.bulkAdd([track("n1", { likedAt: 5, duration: 60, pinned: 0 }), track("n2", { likedAt: 0 })]);
    await db.counters.put({ id: "members", count: 99, seconds: 0 });

    const rebuilt = await counterRepository.rebuild();

    expect(rebuilt).toEqual(counted(3, 560, 4));
    expect(await counterRepository.getAll()).toEqual(rebuilt);
    expect(await recount()).toEqual(rebuilt);
  });

  it("a bare repository write outside a unit of work still changes both tables together", async () => {
    await trackRepository.setLiked(M2, true);
    expect((await db.tracks.get(M2))?.likedAt).toBeGreaterThan(0);
    expect(await liked()).toEqual({ id: "liked", count: 3, seconds: 700 });

    const failure = await trackRepository.createMany([track("n1", { likedAt: 5 }), track("m1")]).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DbError);
    expect(await db.tracks.get(TrackId("n1"))).toBeUndefined();
    expect(await counterRepository.getAll()).toEqual(counted(3, 700, 3));

    await Promise.all([
      trackRepository.setLiked(M3, true),
      trackRepository.likeMany([S2], 40),
      trackRepository.create(track("n2", { likedAt: 6, duration: 10 })),
      trackRepository.update(M1, { duration: 150 }),
    ]);
    expect(await counterRepository.getAll()).toEqual(counted(6, 1560, 4));
    expect(await counterRepository.getAll()).toEqual(await recount());
  });
});
