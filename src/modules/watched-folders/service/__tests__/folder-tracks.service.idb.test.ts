import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { cleanupAfterTrackRemoval } from "@/services/library-gc";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import {
  countFolderTracks,
  deleteFolderTracks,
  getFolderTracks,
  relinkFolderTracks,
} from "../folder-tracks.service";

vi.mock("@/services/library-gc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/library-gc")>();
  return { ...actual, cleanupAfterTrackRemoval: vi.fn(actual.cleanupAfterTrackRemoval) };
});

const AL1 = AlbumId("al1");
const AL2 = AlbumId("al2");
const AR1 = ArtistId("ar1");
const AR2 = ArtistId("ar2");

const track = (id: string, storagePath: string, albumId: AlbumId, artistId: ArtistId): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [artistId],
  albumId,
  tagIds: [],
  source: TrackSource.LOCAL_EXTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
});

const SEED: TrackEntity[] = [
  track("a", "/music/a.mp3", AL1, AR1),
  track("b", "/music/b.mp3", AL1, AR1),
  track("c", "/music/nested/c.mp3", AL2, AR2),
  track("d", "/music2/d.mp3", AL1, AR1),
];

const idsOf = (rows: readonly TrackEntity[]) => rows.map(row => row.id).sort();

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  await db.tracks.bulkAdd(SEED);
  await db.albums.bulkAdd([
    { id: AL1, title: "One", artistId: AR1, pinned: 1, addedAt: 1, updatedAt: 1 },
    { id: AL2, title: "Two", artistId: AR2, pinned: 1, addedAt: 1, updatedAt: 1 },
  ]);
  await db.artists.bulkAdd([
    { id: AR1, name: "Artist 1", pinned: 1, addedAt: 1, updatedAt: 1 },
    { id: AR2, name: "Artist 2", pinned: 1, addedAt: 1, updatedAt: 1 },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("folder tracks", () => {
  it("getFolderTracks returns the folder's rows, leaving out nested folders and a sibling sharing the prefix", async () => {
    expect(idsOf(await getFolderTracks("/music"))).toEqual(["a", "b", "c"]);
    expect(idsOf(await getFolderTracks("/music", ["/music/nested"]))).toEqual(["a", "b"]);
  });

  it("countFolderTracks counts the rows getFolderTracks returns", async () => {
    expect(await countFolderTracks("/music")).toBe(3);
    expect(await countFolderTracks("/music", ["/music/nested"])).toBe(2);
    expect(await countFolderTracks("/missing")).toBe(0);
  });

  it("deleteFolderTracks drops the rows and keeps an album and artist other rows still reference", async () => {
    await deleteFolderTracks(await getFolderTracks("/music", ["/music/nested"]));

    expect((await db.tracks.toCollection().primaryKeys()).sort()).toEqual(["c", "d"]);
    expect(await db.albums.get(AL1)).toBeDefined();
    expect(await db.artists.get(AR1)).toBeDefined();
  });

  it("deleteFolderTracks cascades onto the album and artist the rows orphaned", async () => {
    await deleteFolderTracks(await getFolderTracks("/music/nested"));

    expect(await db.tracks.get(TrackId("c"))).toBeUndefined();
    expect(await db.albums.get(AL2)).toBeUndefined();
    expect(await db.artists.get(AR2)).toBeUndefined();
    expect(await db.albums.get(AL1)).toBeDefined();
  });

  it("deleteFolderTracks keeps the rows when the cascade fails", async () => {
    vi.mocked(cleanupAfterTrackRemoval).mockRejectedValueOnce(new Error("cascade failed"));

    await expect(deleteFolderTracks(await getFolderTracks("/music/nested"))).rejects.toThrow();

    expect(await db.tracks.get(TrackId("c"))).toBeDefined();
    expect(await db.albums.get(AL2)).toBeDefined();
  });

  it("relinkFolderTracks rebases every row under the old path and leaves the rest alone", async () => {
    await relinkFolderTracks("/music", "/library");

    const paths = Object.fromEntries((await db.tracks.toArray()).map(row => [row.id, row.storagePath]));
    expect(paths).toEqual({
      a: "/library/a.mp3",
      b: "/library/b.mp3",
      c: "/library/nested/c.mp3",
      d: "/music2/d.mp3",
    });
  });
});
