import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import type { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { measureRecordReads } from "@/test/idb-meter";
import { trackRepository } from "../track.repository";

//
// Library listings must page through an index instead of walking every row a
// JS membership filter is about to drop. The cost is invisible in the
// returned rows, so these assert on records read at the storage boundary
// (see idb-meter).
//
// Two bars, because `pinned` can be compounded with the sort field but not
// with the multi-entry `artistIds` index (IndexedDB forbids multiEntry in a
// compound key):
//   - sorted whole-library reads skip the offset outright (`reads`);
//   - artist-scoped reads still walk their artist's keys, but must not
//     materialize a row they will not return (`valueReads`).
//

const MEMBERS = 300;
const SHADOWS = 5;
const OFFSET = 200;
const LIMIT = 50;

const ARTIST = "ar1" as ArtistId;
const ALBUM = "al1" as AlbumId;

const track = (index: number, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: `t${String(index).padStart(4, "0")}` as TrackId,
  title: `title-${String(index).padStart(4, "0")}`,
  artistName: "A",
  albumTitle: "",
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
  likedAt: index + 1,
  ...overrides,
});

// Shadow rows share the artist and album but are not library members, so
// every listing and count below has to leave them out.
const shadow = (index: number) =>
  track(1000 + index, { id: `s${index}` as TrackId, pinned: 0, likedAt: undefined });

const expectedPage = Array.from(
  { length: LIMIT },
  (_, i) => `t${String(OFFSET + i).padStart(4, "0")}`,
);

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.tracks.bulkAdd([
    ...Array.from({ length: MEMBERS }, (_, i) => track(i)),
    ...Array.from({ length: SHADOWS }, (_, i) => shadow(i)),
  ]);
});

describe("findAllSortedPaginated", () => {
  it("returns the requested page, shadow rows excluded", async () => {
    const page = (await trackRepository.findAllSortedPaginated("date_added_asc", OFFSET, LIMIT))._unsafeUnwrap();

    expect(page.map(t => t.id)).toEqual(expectedPage);
  });

  // The liked list already pages through a compound index and is the control:
  // if the meter were blind, both numbers would come out the same.
  it("reads no more rows than the liked list does for the same page", async () => {
    const liked = await measureRecordReads(() =>
      trackRepository.findLikedSortedPaginated("date_added_asc", OFFSET, LIMIT),
    );
    const all = await measureRecordReads(() =>
      trackRepository.findAllSortedPaginated("date_added_asc", OFFSET, LIMIT),
    );

    expect(liked.reads).toBeGreaterThan(0);
    expect(liked.reads).toBeLessThan(OFFSET);
    expect(all.reads).toBeLessThanOrEqual(liked.reads);
  });
});

describe("sorted listings cover the whole key range", () => {
  // The upper bound of a string sort field is hand-rolled as "￿", which
  // is not the top of the key space: any longer string starting with that
  // unit sorts above it and drops out of the listing entirely. Tag text comes
  // from files and is not guaranteed to be well-formed.
  it("keeps a title that sorts above a single \\uffff", async () => {
    const odd = "t-odd" as TrackId;
    await db.tracks.put(track(9100, { id: odd, title: "￿￿" }));

    const sorted = (await trackRepository.findAllSorted("title_asc"))._unsafeUnwrap();

    expect(sorted.map(t => t.id)).toContain(odd);
  });

  it("keeps a duration below zero", async () => {
    const odd = "t-negative" as TrackId;
    await db.tracks.put(track(9101, { id: odd, duration: -1 }));

    const sorted = (await trackRepository.findAllSorted("duration_asc"))._unsafeUnwrap();

    expect(sorted.map(t => t.id)).toContain(odd);
  });

  // The liked list pages through [<field>+likedAt] and hand-rolls the same
  // bounds, with 0 as the numeric floor.
  it("keeps a liked track whose sort field is below the hand-rolled floor", async () => {
    const odd = "t-liked-negative" as TrackId;
    await db.tracks.put(track(9102, { id: odd, duration: -1, likedAt: 5 }));

    const sorted = (await trackRepository.findLikedSorted("duration_asc"))._unsafeUnwrap();

    expect(sorted.map(t => t.id)).toContain(odd);
  });

  it("keeps a liked track whose title sorts above a single \\uffff", async () => {
    const odd = "t-liked-odd" as TrackId;
    await db.tracks.put(track(9103, { id: odd, title: "￿￿", likedAt: 5 }));

    const sorted = (await trackRepository.findLikedSorted("title_asc"))._unsafeUnwrap();

    expect(sorted.map(t => t.id)).toContain(odd);
  });
});

describe("findPaginated", () => {
  it("does not read the rows it skips", async () => {
    const { result, reads } = await measureRecordReads(() =>
      trackRepository.findPaginated(OFFSET, LIMIT),
    );

    expect(result._unsafeUnwrap()).toHaveLength(LIMIT);
    expect(reads).toBeLessThan(OFFSET);
  });
});

describe("findIdsByArtistId", () => {
  it("returns the artist's member ids, shadow rows excluded", async () => {
    const ids = (await trackRepository.findIdsByArtistId(ARTIST))._unsafeUnwrap();

    expect(ids).toHaveLength(MEMBERS);
    expect(ids.some(id => id.startsWith("s"))).toBe(false);
  });

  // The artist listing is cut from these ids (see artist.queries), so the
  // whole list is answered without deserializing a single row.
  it("materializes no rows at all", async () => {
    const { valueReads } = await measureRecordReads(() =>
      trackRepository.findIdsByArtistId(ARTIST),
    );

    expect(valueReads).toBe(0);
  });
});

describe("library-membership counts", () => {
  it("countByAlbumIds returns an empty map without reading anything", async () => {
    const { result, reads } = await measureRecordReads(() => trackRepository.countByAlbumIds([]));

    expect(result._unsafeUnwrap().size).toBe(0);
    expect(reads).toBe(0);
  });

  it("countByArtistIds counts a shared track once and ignores artists not asked for", async () => {
    const other = "ar2" as ArtistId;
    await db.tracks.put(track(9001, { id: "shared" as TrackId, artistIds: [ARTIST, other] }));

    const counts = (await trackRepository.countByArtistIds([ARTIST]))._unsafeUnwrap();

    expect(counts.get(ARTIST)).toBe(MEMBERS + 1);
    expect(counts.has(other)).toBe(false);
  });

  it("countByAlbumIds counts members without materializing the library", async () => {
    const { result, valueReads } = await measureRecordReads(() =>
      trackRepository.countByAlbumIds([ALBUM]),
    );

    expect(result._unsafeUnwrap().get(ALBUM)).toBe(MEMBERS);
    expect(valueReads).toBeLessThanOrEqual(SHADOWS);
  });

  it("countByArtistIds counts members without materializing the library", async () => {
    const { result, valueReads } = await measureRecordReads(() =>
      trackRepository.countByArtistIds([ARTIST]),
    );

    expect(result._unsafeUnwrap().get(ARTIST)).toBe(MEMBERS);
    expect(valueReads).toBeLessThanOrEqual(SHADOWS);
  });

  // Shadow rows accrue for every remote track ever queued from browsing, so
  // the set is not small for anyone with a source connected. Subtracting it
  // is a key-only intersection: the count must not pay to deserialize rows
  // that belong to some other artist entirely. (`reads` does grow with the
  // set, and deliberately so — no index can count an artist's members.)
  it("countByArtistIds materializes no row for shadows of other artists", async () => {
    const other = "ar-other" as ArtistId;
    await db.tracks.bulkPut(
      Array.from({ length: 300 }, (_, i) =>
        track(5000 + i, { id: `other-shadow-${i}` as TrackId, pinned: 0, artistIds: [other] })),
    );

    const { result, valueReads } = await measureRecordReads(() =>
      trackRepository.countByArtistIds([ARTIST]),
    );

    expect(result._unsafeUnwrap().get(ARTIST)).toBe(MEMBERS);
    expect(valueReads).toBe(0);
  });
});
