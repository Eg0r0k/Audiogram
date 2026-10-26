import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { unitOfWork } from "@/db/unit-of-work";
import { measureRecordReads } from "@/test/idb-meter";
import { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import type { TrackSortKey } from "@/types/track-sort";
import { counterRepository } from "../counter.repository";
import { trackRepository } from "../track.repository";
import type { TrackIndexKey, TrackScope } from "../track.scope";

const AL1 = AlbumId("al1");
const AL2 = AlbumId("al2");
const AR1 = ArtistId("ar1");
const AR2 = ArtistId("ar2");
const TG = TagId("tg1");

const track = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [],
  albumId: AL1,
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

const first = { albumId: AL1, albumTitle: "First" };
const second = { albumId: AL2, albumTitle: "Second" };

// Members m*, shadows s*; titles and album titles repeat so ties show up in every sort.
const SEED: TrackEntity[] = [
  track("m1", { ...first, artistIds: [AR1], title: "Bravo", addedAt: 1, duration: 100, likedAt: 50, tagIds: [TG] }),
  track("m2", { ...first, artistIds: [AR1], title: "Alpha", addedAt: 2, duration: 200 }),
  track("m3", { ...first, artistIds: [AR1, AR2], title: "Bravo", addedAt: 3, duration: 300, likedAt: 10 }),
  track("m4", { ...second, artistIds: [AR2], title: "Delta", addedAt: 4, duration: 400, tagIds: [TG] }),
  track("m5", { ...second, artistIds: [AR2], title: "Charlie", addedAt: 5, duration: 500, likedAt: 30 }),
  track("m6", { ...second, artistIds: [AR1], title: "Echo", addedAt: 6, duration: 600 }),
  track("m7", { ...first, artistIds: [AR2], title: "Alpha", addedAt: 7, duration: 700, tagIds: [TG] }),
  track("m8", { ...second, artistIds: [AR1], title: "Juliet", addedAt: 8, duration: 800 }),
  track("s1", { ...first, artistIds: [AR1], title: "Foxtrot", addedAt: 9, duration: 900, likedAt: 40, tagIds: [TG], pinned: 0 }),
  track("s2", { ...first, artistIds: [AR1], title: "Golf", addedAt: 10, duration: 1000, pinned: 0 }),
  track("s3", { ...second, artistIds: [AR2], title: "Hotel", addedAt: 11, duration: 1100, likedAt: 20, pinned: 0 }),
  track("s4", { ...second, artistIds: [AR2], title: "India", addedAt: 12, duration: 1200, pinned: 0 }),
];

const PICKED = [TrackId("m5"), TrackId("nope"), TrackId("s1"), TrackId("m1"), TrackId("m5")];

const idsOf = (rows: readonly TrackEntity[]) => rows.map(row => row.id);

const tableProto = () => Object.getPrototypeOf(db.tracks) as Record<string, (...args: unknown[]) => unknown>;

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.tracks.bulkAdd(SEED);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TrackScope", () => {
  it("a scope is inert until a projection runs", async () => {
    const proto = tableProto();
    const reads = ["where", "orderBy", "toCollection", "bulkGet", "toArray", "get"].map(name => vi.spyOn(proto, name));
    const transaction = vi.spyOn(db, "transaction");

    const scopes = [
      trackRepository.all(),
      trackRepository.members(),
      trackRepository.liked().members(),
      trackRepository.inAlbum(AL1).members(),
      trackRepository.byArtist(AR1).members(),
      trackRepository.withTag(TG).members(),
      trackRepository.withIds(PICKED).members(),
    ];

    for (const spy of reads) expect(spy).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();

    expect(await scopes[3].count()).toBe(4);
    expect(proto.where).toHaveBeenCalledWith("[albumId+pinned]");
  });

  it("rows, ids, count and sumDuration agree on every scope", async () => {
    const isMember = (row: TrackEntity) => row.pinned === 1;
    const cases: [string, TrackScope, (row: TrackEntity) => boolean][] = [
      ["all", trackRepository.all(), () => true],
      ["liked", trackRepository.liked(), row => (row.likedAt ?? 0) > 0],
      ["inAlbum", trackRepository.inAlbum(AL1), row => row.albumId === AL1],
      ["byArtist", trackRepository.byArtist(AR1), row => row.artistIds.includes(AR1)],
      ["withTag", trackRepository.withTag(TG), row => row.tagIds.includes(TG)],
      ["withIds", trackRepository.withIds(PICKED), row => PICKED.includes(row.id)],
    ];
    const sorts: (TrackSortKey | undefined)[] = [undefined, "title_desc", "album_asc"];

    for (const [name, scope, matches] of cases) {
      for (const [label, scoped, expected] of [
        [name, scope, matches],
        [`${name}.members`, scope.members(), (row: TrackEntity) => matches(row) && isMember(row)],
      ] as const) {
        const rows = await scoped.rows();
        const expectedIds = idsOf(SEED.filter(expected)).sort();

        expect([...idsOf(rows)].sort(), label).toEqual(expectedIds);
        expect(await scoped.ids(), label).toEqual(idsOf(rows));
        expect(await scoped.count(), label).toBe(rows.length);
        expect(await scoped.sumDuration(), label).toBe(rows.reduce((total, row) => total + row.duration, 0));
        expect((await scoped.first())?.id, label).toBe(rows[0]?.id);

        for (const sort of sorts) {
          const sorted = await scoped.rows({ sort });
          expect(await scoped.ids(sort), `${label} ${sort}`).toEqual(idsOf(sorted));
          expect([...idsOf(sorted)].sort(), `${label} ${sort}`).toEqual(expectedIds);
        }
      }
    }
  });

  it("members().rows with offset and limit pages the index in sort order, duplicates included", async () => {
    const where = vi.spyOn(tableProto(), "where");
    const members = trackRepository.members();

    const ascending = ["m2", "m7", "m1", "m3", "m5", "m4", "m6", "m8"];
    expect(idsOf(await members.rows({ sort: "title_asc" }))).toEqual(ascending);
    expect(where).toHaveBeenCalledWith("[pinned+title+id]");

    const pages = [
      await members.rows({ sort: "title_asc", offset: 0, limit: 3 }),
      await members.rows({ sort: "title_asc", offset: 3, limit: 3 }),
      await members.rows({ sort: "title_asc", offset: 6, limit: 3 }),
    ];
    expect(pages.map(idsOf)).toEqual([["m2", "m7", "m1"], ["m3", "m5", "m4"], ["m6", "m8"]]);

    expect(idsOf(await members.rows({ sort: "title_desc", offset: 1, limit: 3 }))).toEqual(["m6", "m4", "m5"]);
    expect(idsOf(await members.rows({ sort: "title_desc", offset: 4 }))).toEqual(["m3", "m1", "m7", "m2"]);
  });

  it("liked includes a liked shadow row and excludes an unliked member", async () => {
    const newestFirst = idsOf(await trackRepository.liked().rows());
    expect(newestFirst).toEqual(["m1", "s1", "m5", "s3", "m3"]);
    expect(newestFirst).not.toContain("m2");

    expect(idsOf(await trackRepository.liked().rows({ sort: "title_asc" }))).toEqual(["m3", "m1", "m5", "s1", "s3"]);
    expect(idsOf(await trackRepository.liked().members().rows())).toEqual(["m1", "m5", "m3"]);
  });

  it("inAlbum(id).members().count ignores the album's shadow rows", async () => {
    expect(await trackRepository.inAlbum(AL1).count()).toBe(6);
    expect(await trackRepository.inAlbum(AL1).members().count()).toBe(4);
    expect(await trackRepository.inAlbum(AL1).members().sumDuration()).toBe(100 + 200 + 300 + 700);
  });

  it("byArtist(id).members().ids excludes the artist's shadow rows and reads no row outside the artist", async () => {
    await db.tracks.bulkAdd(Array.from({ length: 50 }, (_, i) =>
      track(`other-${String(i).padStart(2, "0")}`, { artistIds: [ArtistId("ar-other")], pinned: 0 })));
    const artistRows = SEED.filter(row => row.artistIds.includes(AR1)).length;
    const where = vi.spyOn(tableProto(), "where");

    const { result, reads, valueReads } = await measureRecordReads(() => trackRepository.byArtist(AR1).members().ids());

    expect(result).toEqual(["m1", "m2", "m3", "m6", "m8"]);
    expect(where).not.toHaveBeenCalledWith("pinned");
    expect(reads).toBeLessThanOrEqual(artistRows);
    expect(valueReads).toBeLessThanOrEqual(artistRows);
  });

  it("withIds(ids).rows keeps the caller's order and drops missing ids", async () => {
    expect(idsOf(await trackRepository.withIds(PICKED).rows())).toEqual(["m5", "s1", "m1"]);
    expect(await trackRepository.withIds(PICKED).ids()).toEqual(["m5", "s1", "m1"]);
    expect(idsOf(await trackRepository.withIds(PICKED).members().rows())).toEqual(["m5", "m1"]);
    expect(idsOf(await trackRepository.withIds(PICKED).rows({ offset: 1, limit: 1 }))).toEqual(["s1"]);
    expect((await trackRepository.withIds(PICKED).first())?.id).toBe("m5");
    expect(await trackRepository.withIds([]).rows()).toEqual([]);
  });

  it("withIds(ids).rows with a sort orders by the plain index of the sort field", async () => {
    const ids = [...SEED].reverse().map(row => row.id).concat(TrackId("nope"));
    const sorts: [TrackSortKey, keyof TrackEntity][] = [
      ["title_asc", "title"],
      ["title_desc", "title"],
      ["album_asc", "albumTitle"],
      ["album_desc", "albumTitle"],
      ["duration_desc", "duration"],
      ["plays_desc", "playCount"],
    ];

    for (const [sort, field] of sorts) {
      const legacy = await db.tracks.where("id").anyOf(ids).sortBy(field);
      if (sort.endsWith("_desc")) legacy.reverse();

      expect(idsOf(await trackRepository.withIds(ids).rows({ sort })), sort).toEqual(idsOf(legacy));
    }
  });

  it("inAlbum(id).modify rewrites every row of the album and returns the count", async () => {
    expect(await trackRepository.inAlbum(AL1).modify({ albumTitle: "Renamed" })).toBe(6);

    const rows = await db.tracks.toArray();
    expect(rows.filter(row => row.albumId === AL1).every(row => row.albumTitle === "Renamed")).toBe(true);
    expect(rows.filter(row => row.albumId === AL2).every(row => row.albumTitle === "Second")).toBe(true);

    const bumped = await trackRepository.inAlbum(AL2).members().modify((row) => { row.playCount += 1; });
    expect(bumped).toBe(4);
    const plays = new Map((await db.tracks.toArray()).map(row => [row.id, row.playCount]));
    expect([plays.get(TrackId("m4")), plays.get(TrackId("s3")), plays.get(TrackId("s4"))]).toEqual([1, 0, 0]);
  });

  it("byArtist(id).delete removes the artist's rows only", async () => {
    expect(await trackRepository.byArtist(AR2).delete()).toBe(6);
    expect((await db.tracks.toCollection().primaryKeys()).sort()).toEqual(["m1", "m2", "m6", "m8", "s1", "s2"]);

    expect(await trackRepository.byArtist(AR1).members().delete()).toBe(4);
    expect((await db.tracks.toCollection().primaryKeys()).sort()).toEqual(["s1", "s2"]);
  });

  it("scope.delete and scope.modify adjust the counters for the rows they touch", async () => {
    const counted = (likedCount: number, seconds: number, members: number) => ({
      liked: { id: "liked", count: likedCount, seconds },
      members: { id: "members", count: members, seconds: 0 },
    });
    const recount = async () => {
      const rows = await db.tracks.toArray();
      const liked = rows.filter(row => (row.likedAt ?? 0) > 0);
      return counted(liked.length, liked.reduce((sum, row) => sum + row.duration, 0), rows.filter(row => row.pinned === 1).length);
    };
    await counterRepository.rebuild();
    expect(await counterRepository.getAll()).toEqual(counted(5, 2900, 8));

    await trackRepository.inAlbum(AL2).modify((row) => { row.pinned = 1; });
    expect(await counterRepository.getAll()).toEqual(counted(5, 2900, 10));

    await trackRepository.byArtist(AR1).modify((row) => { row.duration += 1; });
    expect(await counterRepository.getAll()).toEqual(counted(5, 2903, 10));

    expect(await trackRepository.inAlbum(AL1).modify({ likedAt: undefined })).toBe(6);
    expect(await counterRepository.getAll()).toEqual(counted(2, 1600, 10));

    expect(await trackRepository.byArtist(AR2).delete()).toBe(6);
    expect(await counterRepository.getAll()).toEqual(counted(0, 0, 4));
    expect(await counterRepository.getAll()).toEqual(await recount());
  });

  it("a scope bound through unitOfWork.run reads and writes inside the transaction", async () => {
    let countInside = 0;
    let renamedInside = 0;

    const failure = await unitOfWork.run(["tracks", "counters"], async (uow) => {
      await uow.tracks.create(track("m9", { ...first }));
      // Outside Dexie's zone only the scope's own binding reaches the open transaction.
      countInside = await Dexie.ignoreTransaction(() => uow.tracks.inAlbum(AL1).members().count());
      renamedInside = await uow.tracks.inAlbum(AL1).modify({ albumTitle: "Inside" });
      throw new Error("roll back");
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(countInside).toBe(5);
    expect(renamedInside).toBe(7);
    expect(await db.tracks.get(TrackId("m9"))).toBeUndefined();
    expect(await trackRepository.inAlbum(AL1).members().count()).toBe(4);
    expect((await trackRepository.inAlbum(AL1).rows()).every(row => row.albumTitle === "First")).toBe(true);
  });
});

const SORTS: TrackSortKey[] = [
  "date_added_desc", "date_added_asc", "title_asc", "title_desc", "artist_asc", "artist_desc",
  "album_asc", "album_desc", "duration_asc", "duration_desc", "plays_desc",
];

const SAME_MS = 500;

// Every sort field repeats across these rows, and a dozen of them share one like timestamp.
const KEYSET_ROWS: TrackEntity[] = Array.from({ length: 40 }, (_, i) => track(`k${String((i * 17) % 40).padStart(2, "0")}`, {
  title: ["Alpha", "Bravo", "Charlie"][i % 3],
  artistName: ["A", "B"][i % 2],
  albumTitle: i % 4 === 0 ? "Fourth" : "",
  duration: i % 3 === 0 ? 200 : 180,
  playCount: i % 5 === 0 ? 3 : 0,
  addedAt: 100 + Math.floor(i / 4),
  likedAt: i < 12 ? SAME_MS : i % 3 === 0 ? 600 + i : undefined,
  pinned: i % 9 === 8 ? 0 : 1,
}));

const KEYSET_SCOPES = (): [string, TrackScope][] => [
  ["members", trackRepository.members()],
  ["liked", trackRepository.liked()],
  ["liked.members", trackRepository.liked().members()],
];

const walkPages = async (scope: TrackScope, sort: TrackSortKey | undefined, limit: number) => {
  const pages: TrackEntity[][] = [];
  const lasts: TrackIndexKey[] = [];
  let after: TrackIndexKey | null = null;
  do {
    const page = await scope.page({ sort, after, limit });
    pages.push(page.rows);
    after = page.last;
    if (after) lasts.push(after);
  } while (after !== null && pages.length <= 100);
  return { pages, lasts };
};

describe("TrackScope keyset pages", () => {
  beforeEach(async () => {
    await db.tracks.bulkAdd(KEYSET_ROWS);
  });

  it("page resumes exactly after the returned key across rows sharing the sort value", async () => {
    for (const [name, scope] of KEYSET_SCOPES()) {
      const sorts = name === "members" ? SORTS : [undefined, ...SORTS];
      for (const sort of sorts) {
        const label = `${name} ${sort}`;
        const expected = idsOf(await scope.rows({ sort }));
        const { pages } = await walkPages(scope, sort, 7);

        expect(expected.length, label).toBeGreaterThan(14);
        expect(pages.slice(0, -1).every(page => page.length === 7), label).toBe(true);
        expect(pages.flatMap(idsOf), label).toEqual(expected);
      }
    }
  });

  it("page returns last null when the page is short", async () => {
    const members = trackRepository.members();
    const total = await members.count();

    const short = await members.page({ sort: "plays_desc", limit: total + 1 });
    expect(short.rows).toHaveLength(total);
    expect(short.last).toBeNull();

    const exact = await members.page({ sort: "plays_desc", limit: total });
    expect(exact.rows).toHaveLength(total);
    expect(exact.last).not.toBeNull();
    expect(await members.page({ sort: "plays_desc", after: exact.last, limit: total })).toEqual({ rows: [], first: null, last: null });
  });

  it("page returns the first and last keys of the rows it holds", async () => {
    for (const [name, scope] of KEYSET_SCOPES()) {
      for (const sort of [undefined, "title_asc", "duration_desc", "date_added_desc"] as const) {
        if (name === "members" && sort === undefined) continue;
        const label = `${name} ${sort}`;
        const head = await scope.page({ sort, limit: 7 });
        const next = await scope.page({ sort, after: head.last, limit: 7 });

        expect(idsOf(await scope.window({ sort, from: head.first!, to: next.first })), label).toEqual(idsOf(head.rows));
        expect(idsOf(await scope.window({ sort, from: head.first!, to: head.last })), label).toEqual(idsOf(head.rows.slice(0, -1)));
      }
    }

    const members = trackRepository.members();
    const short = await members.page({ sort: "album_asc", limit: 1000 });
    expect(short.last).toBeNull();
    expect(idsOf(await members.window({ sort: "album_asc", from: short.first!, to: null }))).toEqual(idsOf(short.rows));

    const one = await members.page({ sort: "title_asc", limit: 1 });
    expect(one.first).toEqual([1, one.rows[0].title, one.rows[0].id]);
    expect(one.last).toEqual(one.first);
  });

  it("liked pages in like order resume across rows liked in the same millisecond", async () => {
    const liked = trackRepository.liked();
    const expected = idsOf(await liked.rows());
    const sameMs = KEYSET_ROWS.filter(row => row.likedAt === SAME_MS).map(row => row.id).sort().reverse();

    const { pages } = await walkPages(liked, undefined, 5);
    const walked = pages.flatMap(idsOf);

    expect(walked).toEqual(expected);
    expect(new Set(walked).size).toBe(walked.length);
    expect(walked.filter(id => sameMs.includes(id))).toEqual(sameMs);
    expect(pages.filter(page => page.some(row => row.likedAt === SAME_MS)).length).toBeGreaterThan(1);
  });

  it("window returns the rows with from <= key < to and nothing else", async () => {
    for (const [name, scope] of KEYSET_SCOPES()) {
      for (const sort of [undefined, "title_asc", "duration_desc", "date_added_desc"] as const) {
        if (name === "members" && sort === undefined) continue;
        const label = `${name} ${sort}`;
        const expected = idsOf(await scope.rows({ sort }));
        const { lasts } = await walkPages(scope, sort, 3);

        expect(idsOf(await scope.window({ sort, from: lasts[0], to: lasts[2] })), label).toEqual(expected.slice(2, 8));
        expect(idsOf(await scope.window({ sort, from: lasts[1], to: lasts[1] })), label).toEqual([]);
      }
    }
  });

  it("window with to null runs to the end of the index", async () => {
    for (const [name, scope] of KEYSET_SCOPES()) {
      for (const sort of [undefined, "album_asc", "plays_desc"] as const) {
        if (name === "members" && sort === undefined) continue;
        const label = `${name} ${sort}`;
        const expected = idsOf(await scope.rows({ sort }));
        const { lasts } = await walkPages(scope, sort, 4);

        expect(idsOf(await scope.window({ sort, from: lasts[1], to: null })), label).toEqual(expected.slice(7));
      }
    }
  });

  it("window with from null starts at the top of the index", async () => {
    for (const [name, scope] of KEYSET_SCOPES()) {
      for (const sort of [undefined, "title_asc", "date_added_desc", "plays_desc"] as const) {
        if (name === "members" && sort === undefined) continue;
        const label = `${name} ${sort}`;
        const expected = idsOf(await scope.rows({ sort }));
        const { lasts } = await walkPages(scope, sort, 4);

        expect(idsOf(await scope.window({ sort, from: null, to: lasts[1] })), label).toEqual(expected.slice(0, 7));
        expect(idsOf(await scope.window({ sort, from: null, to: null })), label).toEqual(expected);
      }
    }

    const liked = trackRepository.liked();
    const head = await liked.page({ limit: 4 });
    await trackRepository.setLiked(TrackId("m2"), true);

    expect(idsOf(await liked.window({ from: null, to: head.last }))[0]).toBe("m2");
    expect(idsOf(await liked.window({ from: head.first!, to: head.last }))).not.toContain("m2");
  });

  it("page on an album scope rejects", async () => {
    await expect(trackRepository.inAlbum(AL1).members().page({ sort: "title_asc", limit: 5 }))
      .rejects.toThrow("page() needs an index-ordered scope");
    await expect(trackRepository.inAlbum(AL1).page({ limit: 5 }))
      .rejects.toThrow("page() needs an index-ordered scope");
    await expect(trackRepository.members().page({ limit: 5 }))
      .rejects.toThrow("page() needs an index-ordered scope");
    await expect(trackRepository.inAlbum(AL1).window({ sort: "title_asc", from: [1, "Alpha", "m2"], to: null }))
      .rejects.toThrow("window() needs an index-ordered scope");
  });
});
