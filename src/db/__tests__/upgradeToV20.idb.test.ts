import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppDatabase } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";

// The v19 tracks spec verbatim from AppDatabase.
const V19_TRACKS = "&id, title, artistName, albumTitle, *artistIds, albumId, *tagIds, likedAt, addedAt, duration, playCount, storagePath, fingerprint, pinned, sourceRef, [albumId+pinned], [title+likedAt], [addedAt+likedAt], [duration+likedAt], [artistName+likedAt], [albumTitle+likedAt], [playCount+likedAt], [pinned+title], [pinned+artistName], [pinned+albumTitle], [pinned+addedAt], [pinned+duration], [pinned+playCount]";

const SORT_FIELDS = ["title", "artistName", "albumTitle", "addedAt", "duration", "playCount"];

const ID_TAILED = [
  ...SORT_FIELDS.map(field => `[pinned+${field}+id]`),
  ...SORT_FIELDS.map(field => `[${field}+likedAt+id]`),
  "[likedAt+id]",
];

const V17_COMPOUND = [
  ...SORT_FIELDS.map(field => `[pinned+${field}]`),
  ...SORT_FIELDS.map(field => `[${field}+likedAt]`),
];

const PLAIN = ["title", "artistName", "albumTitle", "artistIds", "albumId", "tagIds", "likedAt", "addedAt", "duration", "playCount", "storagePath", "fingerprint", "pinned", "sourceRef"];

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
  track("t1", { addedAt: 3, likedAt: 7 }),
  track("t2", { addedAt: 1 }),
  track("t3", { addedAt: 1, likedAt: 7 }),
  track("s1", { addedAt: 2, likedAt: 9, pinned: 0 }),
];

let upgraded: AppDatabase | undefined;

beforeEach(async () => {
  const legacy = new Dexie("AudiogramDB");
  legacy.version(19).stores({ tracks: V19_TRACKS });
  await legacy.open();
  await legacy.table("tracks").bulkAdd(ROWS);
  legacy.close();
});

afterEach(async () => {
  upgraded?.close();
  upgraded = undefined;
  await Dexie.delete("AudiogramDB");
});

const openUpgraded = async (): Promise<AppDatabase> => {
  upgraded = new AppDatabase();
  await upgraded.open();
  return upgraded;
};

describe("v19 -> v20 upgrade", () => {
  it("a v19 database opens at v20 with its rows intact", async () => {
    const db = await openUpgraded();

    expect(db.verno).toBeGreaterThanOrEqual(20);
    expect(await db.tracks.orderBy("id").toArray()).toEqual([...ROWS].sort((a, b) => a.id.localeCompare(b.id)));
    expect(await db.tracks.where("[pinned+addedAt+id]").between([1, Dexie.minKey], [1, Dexie.maxKey]).primaryKeys())
      .toEqual(["t2", "t3", "t1"]);
    expect(await db.tracks.where("[likedAt+id]").between([1, Dexie.minKey], [Infinity, Dexie.maxKey]).reverse().primaryKeys())
      .toEqual(["s1", "t3", "t1"]);
  });

  it("v20 lists the thirteen id-tailed indexes and none of the v17 compound ones", async () => {
    const db = await openUpgraded();
    const isCompound = (name: string) => name.startsWith("[");
    const declared = db.tracks.schema.indexes.map(index => index.name);
    const store = db.backendDB().transaction("tracks", "readonly").objectStore("tracks");
    const installed = [...store.indexNames];

    expect(ID_TAILED).toHaveLength(13);
    for (const names of [declared, installed]) {
      expect(names.filter(isCompound).sort()).toEqual(["[albumId+pinned]", ...ID_TAILED].sort());
      expect(names.filter(name => !isCompound(name)).sort()).toEqual([...PLAIN].sort());
      for (const name of V17_COMPOUND) expect(names).not.toContain(name);
    }
  });
});
