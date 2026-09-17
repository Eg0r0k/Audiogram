import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ndAlbumId, ndArtistId, ndTrackId, ymTrackId } from "@/types/track-ref";
import { upgradeToV16 } from "../migrations";

//
// The v16 demotion over a real Dexie transaction (fake-indexeddb): remote
// rows pinned by the old "like = library membership" rule become shadows,
// their albums/artists follow unless a still-pinned (local) track keeps them.
//

const STORES = {
  tracks: "&id, *artistIds, albumId, pinned",
  albums: "&id, pinned",
  artists: "&id, pinned",
};

const track = (id: string, pinned: 0 | 1, albumId = "", artistIds: string[] = []) => ({
  id, pinned, albumId, artistIds, likedAt: 5, playCount: 2,
});

describe("upgradeToV16", () => {
  let db: Dexie;

  beforeEach(async () => {
    db = new Dexie("upgradeToV16-test");
    db.version(1).stores(STORES);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  const run = () => db.transaction("rw", db.tables, tx => upgradeToV16(tx));

  it("demotes remote pinned rows and their albums/artists, keeping likes and counts", async () => {
    await db.table("artists").add({ id: ndArtistId("a1"), pinned: 1 });
    await db.table("albums").add({ id: ndAlbumId("al1"), pinned: 1 });
    await db.table("tracks").bulkAdd([
      track(ndTrackId("s1"), 1, ndAlbumId("al1"), [ndArtistId("a1")]),
      track(ymTrackId("liked"), 1),
    ]);

    await run();

    expect(await db.table("tracks").get(ndTrackId("s1"))).toMatchObject({ pinned: 0, likedAt: 5, playCount: 2 });
    expect((await db.table("tracks").get(ymTrackId("liked"))).pinned).toBe(0);
    expect((await db.table("albums").get(ndAlbumId("al1"))).pinned).toBe(0);
    expect((await db.table("artists").get(ndArtistId("a1"))).pinned).toBe(0);
  });

  it("keeps a remote album/artist pinned while a local pinned track references it", async () => {
    await db.table("artists").add({ id: ndArtistId("a1"), pinned: 1 });
    await db.table("albums").add({ id: ndAlbumId("al1"), pinned: 1 });
    await db.table("tracks").bulkAdd([
      track(ndTrackId("s1"), 1, ndAlbumId("al1"), [ndArtistId("a1")]),
      track("local-s1", 1, ndAlbumId("al1"), [ndArtistId("a1")]),
    ]);

    await run();

    expect((await db.table("tracks").get(ndTrackId("s1"))).pinned).toBe(0);
    expect((await db.table("tracks").get("local-s1")).pinned).toBe(1);
    expect((await db.table("albums").get(ndAlbumId("al1"))).pinned).toBe(1);
    expect((await db.table("artists").get(ndArtistId("a1"))).pinned).toBe(1);
  });

  it("leaves local rows and already-shadow rows alone", async () => {
    await db.table("artists").add({ id: "ar-local", pinned: 1 });
    await db.table("albums").add({ id: "al-local", pinned: 1 });
    await db.table("tracks").bulkAdd([
      track("local-x", 1, "al-local", ["ar-local"]),
      track(ymTrackId("shadow"), 0),
    ]);

    await run();

    expect((await db.table("tracks").get("local-x")).pinned).toBe(1);
    expect((await db.table("albums").get("al-local")).pinned).toBe(1);
    expect((await db.table("artists").get("ar-local")).pinned).toBe(1);
    expect((await db.table("tracks").get(ymTrackId("shadow"))).pinned).toBe(0);
  });
});
