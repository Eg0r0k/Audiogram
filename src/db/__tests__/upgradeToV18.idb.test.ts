import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ndAlbumId, ndArtistId, ndTrackId, ytArtistId, ytTrackId } from "@/types/track-ref";
import { upgradeToV18 } from "../migrations";

//
// v18 over a real Dexie transaction (fake-indexeddb): album and artist rows
// exist only for library members, so every row no pinned track (or, for an
// artist, no surviving album) references is dropped.
//

const STORES = {
  tracks: "&id, *artistIds, albumId, pinned",
  albums: "&id, artistId, pinned",
  artists: "&id, pinned",
};

const UUID = "5924a3f0-0000-4000-8000-000000000001";

const track = (id: string, pinned: 0 | 1, albumId = "", artistIds: string[] = []) => ({
  id, pinned, albumId, artistIds, playCount: 2,
});
const artist = (id: string, pinned: 0 | 1) => ({ id, name: id, pinned });
const album = (id: string, artistId: string, pinned: 0 | 1) => ({ id, title: id, artistId, pinned });

describe("upgradeToV18", () => {
  let db: Dexie;

  beforeEach(async () => {
    db = new Dexie("upgradeToV18-test");
    db.version(1).stores(STORES);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  const run = () => db.transaction("rw", db.tables, tx => upgradeToV18(tx));

  it("deletes the album/artist rows of shadow tracks, keeping the tracks' links", async () => {
    await db.table("artists").add(artist(ndArtistId("a1"), 0));
    await db.table("albums").add(album(ndAlbumId("al1"), ndArtistId("a1"), 0));
    await db.table("tracks").add(track(ndTrackId("s1"), 0, ndAlbumId("al1"), [ndArtistId("a1")]));

    await run();

    expect(await db.table("artists").count()).toBe(0);
    expect(await db.table("albums").count()).toBe(0);
    expect(await db.table("tracks").get(ndTrackId("s1")))
      .toMatchObject({ albumId: ndAlbumId("al1"), artistIds: [ndArtistId("a1")], playCount: 2 });
  });

  it("strips a deleted unprefixed artist from the shadow tracks", async () => {
    await db.table("artists").add(artist(UUID, 0));
    await db.table("tracks").add(track(ytTrackId("v1"), 0, "", [UUID, ytArtistId("UC1")]));

    await run();

    expect(await db.table("artists").get(UUID)).toBeUndefined();
    expect((await db.table("tracks").get(ytTrackId("v1"))).artistIds).toEqual([ytArtistId("UC1")]);
  });

  it("deletes a ghost library artist whose last library track already left", async () => {
    await db.table("artists").add(artist(UUID, 1));
    await db.table("tracks").add(track(ytTrackId("v1"), 0, "", [UUID]));

    await run();

    expect(await db.table("artists").get(UUID)).toBeUndefined();
    expect((await db.table("tracks").get(ytTrackId("v1"))).artistIds).toEqual([]);
  });

  it("keeps rows a library track references and makes them members", async () => {
    await db.table("artists").add(artist(UUID, 0));
    await db.table("albums").add(album("al-local", UUID, 0));
    await db.table("tracks").add(track("local-t", 1, "al-local", [UUID]));

    await run();

    expect((await db.table("artists").get(UUID)).pinned).toBe(1);
    expect((await db.table("albums").get("al-local")).pinned).toBe(1);
  });

  it("keeps an artist that only owns a kept album", async () => {
    await db.table("artists").add(artist("ar-owner", 1));
    await db.table("albums").add(album("al-local", "ar-owner", 1));
    await db.table("tracks").add(track("local-t", 1, "al-local", []));

    await run();

    expect(await db.table("artists").get("ar-owner")).toBeDefined();
  });

  it("leaves local library rows alone", async () => {
    await db.table("artists").add(artist("ar-local", 1));
    await db.table("albums").add(album("al-local", "ar-local", 1));
    await db.table("tracks").add(track("local-x", 1, "al-local", ["ar-local"]));

    await run();

    expect(await db.table("artists").get("ar-local")).toMatchObject({ pinned: 1 });
    expect(await db.table("albums").get("al-local")).toMatchObject({ pinned: 1 });
    expect((await db.table("tracks").get("local-x")).artistIds).toEqual(["ar-local"]);
  });
});
