import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEGACY_QUEUE_STORAGE_KEY, QUEUE_CURSOR_STORAGE_KEY, QUEUE_SNAPSHOT_ID } from "../entities";
import { upgradeToV19 } from "../migrations";

//
// v19 over a real Dexie transaction (fake-indexeddb): the queue snapshot
// moves out of localStorage, where a large queue outgrew the quota, into
// its own table; the current entry and repeat mode stay in a small key.
//

const SNAPSHOT = {
  version: 1,
  queue: [
    { id: "item-1", track: { kind: "library", trackId: "t1" }, source: { type: "manual" }, addedAt: 1 },
    { id: "item-2", track: { kind: "library", trackId: "t2" }, source: { type: "manual" }, addedAt: 2 },
  ],
  originalQueueOrder: ["item-1", "item-2"],
  currentIndex: 1,
  currentItemId: "item-2",
  isShuffled: false,
};

describe("upgradeToV19", () => {
  let db: Dexie;

  beforeEach(async () => {
    localStorage.clear();
    db = new Dexie("upgradeToV19-test");
    db.version(1).stores({ queueSnapshot: "&id" });
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  const run = () => db.transaction("rw", db.tables, tx => upgradeToV19(tx));

  it("moves the stored queue into the table and keeps the cursor and repeat mode", async () => {
    localStorage.setItem(LEGACY_QUEUE_STORAGE_KEY, JSON.stringify({ persistedSnapshot: SNAPSHOT, repeatMode: "one" }));

    await run();

    expect(await db.table("queueSnapshot").get(QUEUE_SNAPSHOT_ID)).toEqual({ id: QUEUE_SNAPSHOT_ID, snapshot: SNAPSHOT });
    expect(JSON.parse(localStorage.getItem(QUEUE_CURSOR_STORAGE_KEY)!)).toEqual({
      persistedCursor: { currentItemId: "item-2" },
      repeatMode: "one",
    });
    expect(localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY)).toBeNull();
  });

  it("leaves the repeat mode out when the old key never stored one", async () => {
    localStorage.setItem(LEGACY_QUEUE_STORAGE_KEY, JSON.stringify({ persistedSnapshot: SNAPSHOT }));

    await run();

    expect(JSON.parse(localStorage.getItem(QUEUE_CURSOR_STORAGE_KEY)!)).toEqual({
      persistedCursor: { currentItemId: "item-2" },
    });
  });

  it("carries the repeat mode over from an empty queue", async () => {
    localStorage.setItem(LEGACY_QUEUE_STORAGE_KEY, JSON.stringify({ persistedSnapshot: null, repeatMode: "all" }));

    await run();

    expect(await db.table("queueSnapshot").count()).toBe(0);
    expect(JSON.parse(localStorage.getItem(QUEUE_CURSOR_STORAGE_KEY)!)).toEqual({ repeatMode: "all" });
    expect(localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY)).toBeNull();
  });

  // A launch whose database failed to open ran on the new key already.
  it("moves the queue but keeps a cursor key a later session wrote", async () => {
    localStorage.setItem(LEGACY_QUEUE_STORAGE_KEY, JSON.stringify({ persistedSnapshot: SNAPSHOT, repeatMode: "one" }));
    localStorage.setItem(QUEUE_CURSOR_STORAGE_KEY, JSON.stringify({ persistedCursor: null, repeatMode: "all" }));

    await run();

    expect(await db.table("queueSnapshot").count()).toBe(1);
    expect(JSON.parse(localStorage.getItem(QUEUE_CURSOR_STORAGE_KEY)!)).toEqual({ persistedCursor: null, repeatMode: "all" });
  });

  it("keeps the old key when the upgrade transaction fails", async () => {
    localStorage.setItem(LEGACY_QUEUE_STORAGE_KEY, JSON.stringify({ persistedSnapshot: SNAPSHOT, repeatMode: "one" }));

    await expect(db.transaction("rw", db.tables, async (tx) => {
      await upgradeToV19(tx);
      throw new Error("later step failed");
    })).rejects.toThrow("later step failed");

    expect(localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY)).not.toBeNull();
    expect(await db.table("queueSnapshot").count()).toBe(0);
  });

  it("does nothing without a stored queue, and never throws on a broken one", async () => {
    await run();
    expect(await db.table("queueSnapshot").count()).toBe(0);
    expect(localStorage.getItem(QUEUE_CURSOR_STORAGE_KEY)).toBeNull();

    localStorage.setItem(LEGACY_QUEUE_STORAGE_KEY, "{not json");
    await run();
    expect(await db.table("queueSnapshot").count()).toBe(0);
    expect(localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY)).toBe("{not json");
  });
});
