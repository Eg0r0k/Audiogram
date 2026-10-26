import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { CounterRepository } from "@/db/repositories/counter.repository";
import { AlbumId, TrackId } from "@/types/ids";

// The v20 tracks spec verbatim from AppDatabase.
const V20_TRACKS = "&id, title, artistName, albumTitle, *artistIds, albumId, *tagIds, likedAt, addedAt, duration, playCount, storagePath, fingerprint, pinned, sourceRef, [albumId+pinned], [likedAt+id], [title+likedAt+id], [addedAt+likedAt+id], [duration+likedAt+id], [artistName+likedAt+id], [albumTitle+likedAt+id], [playCount+likedAt+id], [pinned+title+id], [pinned+artistName+id], [pinned+albumTitle+id], [pinned+addedAt+id], [pinned+duration+id], [pinned+playCount+id]";

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

const ROWS: TrackEntity[] = [
  track("m1", { duration: 100, likedAt: 7 }),
  track("m2", { duration: 200 }),
  track("m3", { duration: 300, likedAt: 9 }),
  track("m4", { duration: 50, likedAt: 0 }),
  track("s1", { duration: 400, likedAt: 3, pinned: 0 }),
  track("s2", { duration: 500, pinned: 0 }),
];

const zero = (id: "liked" | "members") => ({ id, count: 0, seconds: 0 });

let upgraded: AppDatabase | undefined;

const seedV20 = async (rows: TrackEntity[]) => {
  const legacy = new Dexie("AudiogramDB");
  legacy.version(20).stores({ tracks: V20_TRACKS });
  await legacy.open();
  await legacy.table("tracks").bulkAdd(rows);
  legacy.close();
};

const openUpgraded = async (): Promise<AppDatabase> => {
  upgraded = new AppDatabase();
  await upgraded.open();
  return upgraded;
};

afterEach(async () => {
  upgraded?.close();
  upgraded = undefined;
  await Dexie.delete("AudiogramDB");
});

describe("v20 -> v21 upgrade", () => {
  it("v21 computes the liked and member counters from the existing rows", async () => {
    await seedV20(ROWS);
    const db = await openUpgraded();

    expect(db.verno).toBe(21);
    expect(await db.counters.orderBy("id").toArray()).toEqual([
      { id: "liked", count: 3, seconds: 800 },
      { id: "members", count: 4, seconds: 0 },
    ]);
    expect(await db.tracks.count()).toBe(ROWS.length);
  });

  it("a database with no tracks opens with both counters at zero", async () => {
    await seedV20([]);
    const db = await openUpgraded();

    expect(await db.counters.orderBy("id").toArray()).toEqual([zero("liked"), zero("members")]);

    db.close();
    await Dexie.delete("AudiogramDB");
    const fresh = await openUpgraded();

    expect(await fresh.counters.count()).toBe(0);
    expect(await new CounterRepository(fresh).getAll()).toEqual({ liked: zero("liked"), members: zero("members") });
  });
});
