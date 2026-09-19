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
import { getArtistTracksPaginated } from "../artist.queries";

//
// An artist's rows cannot be paged through an index: `artistIds` is
// multi-entry, and IndexedDB forbids multiEntry inside a compound key, so
// membership cannot ride along with it. The list is therefore built in
// memory — and must be built once per (artist, sort), not once per page.
//
// The shadow set is what makes rebuilding expensive. It holds every remote
// track ever queued from browsing, so it belongs to no artist in particular
// and grows for as long as a source stays connected; subtracting it per page
// makes scrolling one artist cost the whole set over and over.
//

const ARTIST = ArtistId("ar-1");
const OTHER = ArtistId("ar-other");
const ALBUM = AlbumId("al-1");
const SIZE = 300;
const LIMIT = 50;
const PAGES = SIZE / LIMIT;
const SHADOWS = 2000;

const track = (index: number, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(`t${String(index).padStart(4, "0")}`),
  title: `title-${String(index).padStart(4, "0")}`,
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

const seedUnrelatedShadows = () =>
  db.tracks.bulkPut(Array.from({ length: SHADOWS }, (_, i) =>
    track(9000 + i, { id: TrackId(`sh-${i}`), pinned: 0, artistIds: [OTHER] })));

let client: QueryClient;

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.albums.put(album);
  await db.artists.put(artist);
  await db.tracks.bulkPut(Array.from({ length: SIZE }, (_, i) => track(i)));
  client = new QueryClient();
});

describe("getArtistTracksPaginated", () => {
  it("leaves shadow rows out of the list and its total", async () => {
    await db.tracks.put(track(9001, { id: TrackId("shadow"), pinned: 0 }));

    const page = await getArtistTracksPaginated(ARTIST, 0, LIMIT, null, client);

    expect(page.total).toBe(SIZE);
    expect(page.tracks.map(t => t.id)).not.toContain("shadow");
  });
});

describe.each([
  ["artist order", null],
  ["a chosen sort", "title_asc" as const],
])("getArtistTracksPaginated in %s", (_label, sortKey) => {
  it("returns the requested page", async () => {
    const first = await getArtistTracksPaginated(ARTIST, 0, LIMIT, sortKey, client);
    const second = await getArtistTracksPaginated(ARTIST, LIMIT, LIMIT, sortKey, client);

    expect(first.tracks).toHaveLength(LIMIT);
    expect(second.tracks).toHaveLength(LIMIT);
    expect(first.total).toBe(SIZE);
    expect(first.tracks.map(t => t.id)).not.toEqual(second.tracks.map(t => t.id));
  });

  it("builds the ordered list once, not once per page", async () => {
    const { valueReads } = await measureRecordReads(async () => {
      for (let offset = 0; offset < SIZE; offset += LIMIT) {
        await getArtistTracksPaginated(ARTIST, offset, LIMIT, sortKey, client);
      }
    });

    expect(valueReads).toBeLessThan(SIZE * PAGES / 2);
  });

  // Keys, not rows: the shadow set is subtracted through primaryKeys(), which
  // never materializes a row, so valueReads cannot see this at all.
  it("does not subtract the shadow set again for every page", async () => {
    await seedUnrelatedShadows();

    const { reads } = await measureRecordReads(async () => {
      for (let offset = 0; offset < SIZE; offset += LIMIT) {
        await getArtistTracksPaginated(ARTIST, offset, LIMIT, sortKey, client);
      }
    });

    // One subtraction for the listing, not one (or two) per page.
    expect(reads).toBeLessThan(SHADOWS * 2);
  });
});
