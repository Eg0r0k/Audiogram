import Dexie, { type Table } from "dexie";
import { describe, expect, it } from "vitest";
import type { TrackEntity } from "@/db/entities";
import { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import { plan, type TrackPlan, type TrackScopeSource, type TrackScopeSpec } from "../track.scope";

type Call = [method: string, ...args: unknown[]];

// A table stand-in that records the chain `build` calls on it; no Dexie behind it.
const recordingTable = () => {
  const calls: Call[] = [];
  const chain: object = new Proxy({}, {
    get: (_, method) => (...args: unknown[]) => {
      calls.push([String(method), ...args]);
      return chain;
    },
  });
  return { table: chain as Table<TrackEntity, TrackId>, calls };
};

const callsOf = (planned: TrackPlan): Call[] => {
  const { table, calls } = recordingTable();
  planned.build(table);
  return calls;
};

const spec = (source: TrackScopeSource, flags: Partial<Omit<TrackScopeSpec, "source">> = {}): TrackScopeSpec => ({
  source,
  members: false,
  liked: false,
  ...flags,
});

const ALL: TrackScopeSource = { kind: "all" };
const ALBUM = AlbumId("al1");
const ARTIST = ArtistId("ar1");
const TAG = TagId("tg1");

const row = (overrides: Partial<TrackEntity>) => ({ pinned: 1, ...overrides }) as TrackEntity;

describe("plan", () => {
  it("members sorted by title plans [pinned+title] ascending", () => {
    const planned = plan(spec(ALL, { members: true }), "title_asc");

    expect(planned).toMatchObject({ kind: "collection", index: "[pinned+title]", ordered: true, reverse: false });
    expect(planned.inMemorySort).toBeUndefined();
    expect(callsOf(planned)).toEqual([
      ["where", "[pinned+title]"],
      ["between", [1, Dexie.minKey], [1, Dexie.maxKey], true, true],
    ]);
  });

  it("members sorted by date_added_desc plans [pinned+addedAt] reversed", () => {
    const planned = plan(spec(ALL, { members: true }), "date_added_desc");

    expect(planned).toMatchObject({ kind: "collection", index: "[pinned+addedAt]", ordered: true, reverse: true });
    expect(callsOf(planned)).toEqual([
      ["where", "[pinned+addedAt]"],
      ["between", [1, Dexie.minKey], [1, Dexie.maxKey], true, true],
      ["reverse"],
    ]);
  });

  it("liked sorted by a field plans [field+likedAt] and ignores membership", () => {
    const planned = plan(spec(ALL, { liked: true }), "duration_desc");

    expect(planned).toMatchObject({ kind: "collection", index: "[duration+likedAt]", ordered: true, reverse: true });
    expect(callsOf(planned)).toEqual([
      ["where", "[duration+likedAt]"],
      ["between", [Dexie.minKey, 1], [Dexie.maxKey, Infinity]],
      ["reverse"],
    ]);

    const members = plan(spec(ALL, { liked: true, members: true }), "duration_desc");
    expect(members).toMatchObject({ kind: "collection", index: "[duration+likedAt]", reverse: true });
    expect(callsOf(members)).toEqual([
      ["where", "[duration+likedAt]"],
      ["between", [Dexie.minKey, 1], [Dexie.maxKey, Infinity]],
      ["and", expect.any(Function)],
      ["reverse"],
    ]);
  });

  it("liked without a sort plans likedAt above 0, most recent first", () => {
    const planned = plan(spec(ALL, { liked: true }));

    expect(planned).toMatchObject({ kind: "collection", index: "likedAt", ordered: true, reverse: true });
    expect(callsOf(planned)).toEqual([
      ["where", "likedAt"],
      ["above", 0],
      ["reverse"],
    ]);
  });

  it("an album with members plans [albumId+pinned]; without members plans albumId", () => {
    const members = plan(spec({ kind: "album", albumId: ALBUM }, { members: true }));
    expect(members).toMatchObject({ kind: "collection", index: "[albumId+pinned]", ordered: false });
    expect(callsOf(members)).toEqual([
      ["where", "[albumId+pinned]"],
      ["equals", [ALBUM, 1]],
    ]);

    const everyRow = plan(spec({ kind: "album", albumId: ALBUM }));
    expect(everyRow).toMatchObject({ kind: "collection", index: "albumId", ordered: false });
    expect(callsOf(everyRow)).toEqual([
      ["where", "albumId"],
      ["equals", ALBUM],
    ]);

    const liked = plan(spec({ kind: "album", albumId: ALBUM }, { liked: true }));
    expect(callsOf(liked)).toEqual([
      ["where", "albumId"],
      ["equals", ALBUM],
      ["and", expect.any(Function)],
    ]);
  });

  it("an album with a sort keeps the index and sorts in memory", () => {
    const planned = plan(spec({ kind: "album", albumId: ALBUM }, { members: true }), "title_desc");

    expect(planned).toMatchObject({
      kind: "collection",
      index: "[albumId+pinned]",
      ordered: false,
      reverse: false,
      inMemorySort: "title_desc",
    });
    expect(callsOf(planned)).toEqual([
      ["where", "[albumId+pinned]"],
      ["equals", [ALBUM, 1]],
    ]);
  });

  it("an artist with members plans artistIds with a pinned filter, without members plans artistIds alone", () => {
    const members = plan(spec({ kind: "artist", artistId: ARTIST }, { members: true }));
    expect(members).toMatchObject({ kind: "collection", index: "artistIds", ordered: false, reverse: false });
    expect(callsOf(members)).toEqual([
      ["where", "artistIds"],
      ["equals", ARTIST],
      ["and", expect.any(Function)],
    ]);
    expect(members.filter?.(row({ pinned: 1 }))).toBe(true);
    expect(members.filter?.(row({ pinned: 0 }))).toBe(false);

    const sorted = plan(spec({ kind: "artist", artistId: ARTIST }, { members: true }), "album_asc");
    expect(sorted).toMatchObject({ index: "artistIds", ordered: false, inMemorySort: "album_asc" });

    const everyRow = plan(spec({ kind: "artist", artistId: ARTIST }));
    expect(everyRow).toMatchObject({ kind: "collection", index: "artistIds", ordered: false });
    expect(everyRow.filter).toBeUndefined();
    expect(callsOf(everyRow)).toEqual([
      ["where", "artistIds"],
      ["equals", ARTIST],
    ]);
  });

  it("withIds with a sort plans anyOf then sortBy; without a sort keeps the caller's order", () => {
    const ids = [TrackId("b"), TrackId("a")];

    const sorted = plan(spec({ kind: "ids", ids }), "title_asc");
    expect(sorted).toMatchObject({ kind: "collection", index: "id", ordered: false, inMemorySort: "title_asc" });
    expect(sorted.keyOrder).toBeUndefined();
    expect(callsOf(sorted)).toEqual([
      ["where", "id"],
      ["anyOf", ids],
    ]);

    const unsorted = plan(spec({ kind: "ids", ids }));
    expect(unsorted).toMatchObject({ kind: "collection", index: "id", keyOrder: ids });
    expect(unsorted.inMemorySort).toBeUndefined();
    expect(callsOf(unsorted)).toEqual([
      ["where", "id"],
      ["anyOf", ids],
    ]);
  });

  it("all without a sort plans a table scan and all with a sort plans the plain index", () => {
    const scan = plan(spec(ALL));
    expect(scan).toMatchObject({ kind: "collection", ordered: false, reverse: false });
    expect(callsOf(scan)).toEqual([["toCollection"]]);

    const ascending = plan(spec(ALL), "artist_asc");
    expect(ascending).toMatchObject({ kind: "collection", index: "artistName", ordered: true, reverse: false });
    expect(callsOf(ascending)).toEqual([["orderBy", "artistName"]]);

    const descending = plan(spec(ALL), "plays_desc");
    expect(descending).toMatchObject({ kind: "collection", index: "playCount", ordered: true, reverse: true });
    expect(callsOf(descending)).toEqual([["orderBy", "playCount"], ["reverse"]]);
  });

  it("a tag scope plans tagIds and applies members as a filter", () => {
    const everyRow = plan(spec({ kind: "tag", tagId: TAG }));
    expect(everyRow).toMatchObject({ kind: "collection", index: "tagIds", ordered: false });
    expect(everyRow.filter).toBeUndefined();
    expect(callsOf(everyRow)).toEqual([
      ["where", "tagIds"],
      ["equals", TAG],
    ]);

    const members = plan(spec({ kind: "tag", tagId: TAG }, { members: true }), "title_asc");
    expect(members.inMemorySort).toBe("title_asc");
    expect(callsOf(members)).toEqual([
      ["where", "tagIds"],
      ["equals", TAG],
      ["and", expect.any(Function)],
    ]);
    expect(members.filter?.(row({ pinned: 1 }))).toBe(true);
    expect(members.filter?.(row({ pinned: 0 }))).toBe(false);
  });
});
