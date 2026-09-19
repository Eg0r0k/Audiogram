import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/vue-query";
import type { AlbumEntity, ArtistEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { measureRecordReads } from "@/test/idb-meter";

vi.mock("@/modules/covers/lib/cover-cache", () => ({
  coverCache: { invalidateAll: vi.fn(), invalidate: vi.fn(), set: vi.fn() },
}));

import { db } from "@/db";
import { getAlbumTracksPaginated } from "../album.queries";

//
// An album's rows have to be ordered by (diskNo, trackNo), which no index
// expresses, so a page is cut from a list built in memory. Building that list
// again for every page is what makes scrolling a long album quadratic; these
// pin it to one build per (album, sort).
//

const ALBUM = AlbumId("al-1");
const ARTIST = ArtistId("ar-1");
const SIZE = 300;
const LIMIT = 50;
const PAGES = SIZE / LIMIT;

const track = (index: number, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(`t${String(index).padStart(4, "0")}`),
  title: `title-${index}`,
  artistName: "Artist",
  albumTitle: "Album",
  artistIds: [ARTIST],
  albumId: ALBUM,
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: `tracks/t${index}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: index,
  trackNo: index + 1,
  ...overrides,
});

const album: AlbumEntity = {
  id: ALBUM,
  title: "Album",
  artistId: ARTIST,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
};

const artist: ArtistEntity = {
  id: ARTIST,
  name: "Artist",
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
};

let client: QueryClient;

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.albums.put(album);
  await db.artists.put(artist);
  await db.tracks.bulkPut(Array.from({ length: SIZE }, (_, i) => track(i)));
  client = new QueryClient();
});

describe("album order", () => {
  it("pages in (diskNo, trackNo) order across the page boundary", async () => {
    await db.tracks.clear();
    await db.tracks.bulkPut([
      track(0, { id: TrackId("d2t1"), diskNo: 2, trackNo: 1 }),
      track(1, { id: TrackId("d1t2"), diskNo: 1, trackNo: 2 }),
      track(2, { id: TrackId("d1t1"), diskNo: 1, trackNo: 1 }),
    ]);

    const first = await getAlbumTracksPaginated(ALBUM, 0, 2, null, client);
    const second = await getAlbumTracksPaginated(ALBUM, 2, 2, null, client);

    expect(first.tracks.map(t => t.id)).toEqual(["d1t1", "d1t2"]);
    expect(second.tracks.map(t => t.id)).toEqual(["d2t1"]);
    expect(first.total).toBe(3);
  });

  // The order is cached with staleTime: Infinity and expires only through the
  // invalidation registry. A delete that has not reached it yet leaves ids
  // naming rows bulkGet can no longer find — the page is short, and a total
  // read off the order would still be counting them.
  it("does not count a row that vanished from under the cached order", async () => {
    await getAlbumTracksPaginated(ALBUM, 0, LIMIT, null, client);
    await db.tracks.delete(TrackId("t0010"));

    const page = await getAlbumTracksPaginated(ALBUM, 0, LIMIT, null, client);

    expect(page.tracks).toHaveLength(LIMIT - 1);
    expect(page.total).toBe(SIZE - 1);
  });

  it("leaves shadow rows out of the list and its total", async () => {
    await db.tracks.put(track(9001, { id: TrackId("shadow"), pinned: 0 }));

    const page = await getAlbumTracksPaginated(ALBUM, 0, LIMIT, null, client);

    expect(page.total).toBe(SIZE);
    expect(page.tracks.map(t => t.id)).not.toContain("shadow");
  });

  // A liked catalog track (shadow) and the local copy downloaded from it share
  // the album row; the page must show the copy once, not both.
  it("shows a downloaded copy once when its catalog twin shares the album", async () => {
    await db.tracks.clear();
    await db.tracks.bulkPut([
      track(0, { id: TrackId("ym:b"), pinned: 0, likedAt: 5 }),
      track(0, { id: TrackId("local-b"), pinned: 1, sourceRef: TrackId("ym:b") }),
    ]);

    const page = await getAlbumTracksPaginated(ALBUM, 0, LIMIT, null, client);

    expect(page.tracks.map(t => t.id)).toEqual(["local-b"]);
    expect(page.total).toBe(1);
  });
});

describe.each([
  ["album order", null],
  ["a chosen sort", "title_asc" as const],
])("getAlbumTracksPaginated in %s", (_label, sortKey) => {
  it("returns the requested page", async () => {
    const first = await getAlbumTracksPaginated(ALBUM, 0, LIMIT, sortKey, client);
    const second = await getAlbumTracksPaginated(ALBUM, LIMIT, LIMIT, sortKey, client);

    expect(first.tracks).toHaveLength(LIMIT);
    expect(second.tracks).toHaveLength(LIMIT);
    expect(first.total).toBe(SIZE);
    expect(first.tracks.map(t => t.id)).not.toEqual(second.tracks.map(t => t.id));
  });

  it("builds the ordered list once, not once per page", async () => {
    const { valueReads } = await measureRecordReads(async () => {
      for (let offset = 0; offset < SIZE; offset += LIMIT) {
        await getAlbumTracksPaginated(ALBUM, offset, LIMIT, sortKey, client);
      }
    });

    // Rebuilding per page costs SIZE × PAGES (1800 here). Cutting from a
    // cached order costs one build, plus each row once more when its page
    // reads it, plus the album and artist rows a page maps through — ~612.
    expect(valueReads).toBeLessThan(SIZE * PAGES / 2);
  });
});
