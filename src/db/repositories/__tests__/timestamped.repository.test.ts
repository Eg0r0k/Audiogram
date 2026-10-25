import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  TrackSource,
  TrackState,
  type AlbumEntity,
  type ArtistEntity,
  type PlaylistEntity,
  type SidebarFolderEntity,
  type SidebarFolderEntryEntity,
  type TrackEntity,
} from "@/db/entities";
import type { AlbumId, ArtistId, PlaylistId, SidebarFolderId, TrackId } from "@/types/ids";
import { albumRepository } from "../album.repository";
import { artistRepository } from "../artist.repository";
import { folderRepository } from "../folder.repository";
import { playlistRepository } from "../playlist.repository";
import { trackRepository } from "../track.repository";

const NOW = new Date(2026, 9, 25, 12, 0, 0).getTime();

const album = (id: string, overrides: Partial<AlbumEntity> = {}): AlbumEntity => ({
  id: id as AlbumId,
  title: id,
  artistId: "ar1" as ArtistId,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const artist = (id: string, overrides: Partial<ArtistEntity> = {}): ArtistEntity => ({
  id: id as ArtistId,
  name: id,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const playlist = (id: string, overrides: Partial<PlaylistEntity> = {}): PlaylistEntity => ({
  id: id as PlaylistId,
  name: id,
  trackIds: [],
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const folder = (id: string, items: SidebarFolderEntryEntity[] = []): SidebarFolderEntity => ({
  id: id as SidebarFolderId,
  name: id,
  items,
  addedAt: 1,
  updatedAt: 1,
});

const track = (id: string): TrackEntity => ({
  id: id as TrackId,
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [],
  albumId: "" as AlbumId,
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: `tracks/${id}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
});

const seedOneOfEach = async () => {
  await db.albums.add(album("al1"));
  await db.artists.add(artist("ar1"));
  await db.playlists.add(playlist("p1"));
  await db.folders.add(folder("f1"));
};

const stampsOfOneOfEach = async () => ({
  album: (await db.albums.get("al1" as AlbumId))?.updatedAt,
  artist: (await db.artists.get("ar1" as ArtistId))?.updatedAt,
  playlist: (await db.playlists.get("p1" as PlaylistId))?.updatedAt,
  folder: (await db.folders.get("f1" as SidebarFolderId))?.updatedAt,
});

const playlistStamp = async (id: string) => (await db.playlists.get(id as PlaylistId))?.updatedAt;

const folderStamps = async () =>
  Object.fromEntries((await db.folders.toArray()).map(row => [row.id, row.updatedAt]));

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("TimestampedRepository partial writes", () => {
  it("update stamps updatedAt when the caller leaves it out", async () => {
    await seedOneOfEach();

    await albumRepository.update("al1" as AlbumId, { title: "New" });
    await artistRepository.update("ar1" as ArtistId, { name: "New" });
    await playlistRepository.update("p1" as PlaylistId, { name: "New" });
    await folderRepository.update("f1" as SidebarFolderId, { name: "New" });

    expect(await stampsOfOneOfEach()).toEqual({ album: NOW, artist: NOW, playlist: NOW, folder: NOW });
  });

  it("update keeps an updatedAt the caller set", async () => {
    await seedOneOfEach();
    await db.playlists.add(playlist("p2"));

    await albumRepository.update("al1" as AlbumId, { title: "New", updatedAt: 42 });
    await artistRepository.update("ar1" as ArtistId, { name: "New", updatedAt: 42 });
    await playlistRepository.update("p1" as PlaylistId, { name: "New", updatedAt: 42 });
    await folderRepository.update("f1" as SidebarFolderId, { name: "New", updatedAt: 42 });
    await playlistRepository.updateMany([{ key: "p2" as PlaylistId, changes: { name: "New", updatedAt: 43 } }]);

    expect(await stampsOfOneOfEach()).toEqual({ album: 42, artist: 42, playlist: 42, folder: 42 });
    expect(await playlistStamp("p2")).toBe(43);
  });

  it("updateMany stamps every row with the same timestamp", async () => {
    await db.playlists.bulkAdd([playlist("p1"), playlist("p2"), playlist("p3")]);
    let tick = NOW;
    vi.spyOn(Date, "now").mockImplementation(() => tick++);

    await playlistRepository.updateMany(["p1", "p2", "p3"].map(id => ({
      key: id as PlaylistId,
      changes: { name: `${id}!` },
    })));

    const rows = await db.playlists.bulkGet(["p1", "p2", "p3"] as PlaylistId[]);
    expect(rows.map(row => row?.updatedAt)).toEqual([NOW, NOW, NOW]);
    expect(rows.map(row => row?.name)).toEqual(["p1!", "p2!", "p3!"]);
  });
});

describe("TimestampedRepository whole-row writes", () => {
  it("upsert and upsertMany write the caller's updatedAt untouched", async () => {
    await db.albums.add(album("al1", { updatedAt: 50 }));

    await albumRepository.upsert(album("al1", { title: "Restored", updatedAt: 7 }));
    await playlistRepository.upsertMany([playlist("p1", { updatedAt: 8 }), playlist("p2", { updatedAt: 9 })]);

    const restored = await db.albums.get("al1" as AlbumId);
    expect(restored?.title).toBe("Restored");
    expect(restored?.updatedAt).toBe(7);
    expect(await playlistStamp("p1")).toBe(8);
    expect(await playlistStamp("p2")).toBe(9);
  });
});

describe("TimestampedRepository modify callbacks and internal transactions", () => {
  it("a playlist track edit touches updatedAt only when the list changed", async () => {
    await db.playlists.add(playlist("p1", { trackIds: ["t1"] as TrackId[] }));
    const p1 = "p1" as PlaylistId;

    await playlistRepository.addTrack(p1, "t1" as TrackId);
    await playlistRepository.addTracks(p1, ["t1"] as TrackId[]);
    await playlistRepository.insertTrack(p1, "t1" as TrackId, 0);
    expect(await playlistStamp("p1")).toBe(1);

    await playlistRepository.addTrack(p1, "t2" as TrackId);
    expect(await playlistStamp("p1")).toBe(NOW);

    vi.setSystemTime(NOW + 1000);
    await playlistRepository.addTracks(p1, ["t2", "t3"] as TrackId[]);
    expect(await playlistStamp("p1")).toBe(NOW + 1000);

    vi.setSystemTime(NOW + 2000);
    await playlistRepository.insertTrack(p1, "t4" as TrackId, 0);
    expect(await playlistStamp("p1")).toBe(NOW + 2000);
    expect((await db.playlists.get(p1))?.trackIds).toEqual(["t4", "t1", "t2", "t3"]);
  });

  it("folder item edits stamp the folder and every folder that lost an item", async () => {
    await db.folders.bulkAdd([
      folder("f1"),
      folder("f2", [{ type: "album", id: "al1" }]),
      folder("f3", [{ type: "playlist", id: "p1" }]),
      folder("f4", [{ type: "artist", id: "ar1" }]),
    ]);

    await folderRepository.setItems("f1" as SidebarFolderId, [{ type: "album", id: "al1" }]);
    expect(await folderStamps()).toEqual({ f1: NOW, f2: NOW, f3: 1, f4: 1 });

    vi.setSystemTime(NOW + 1000);
    await folderRepository.removeItem("playlist", "p1");
    expect(await folderStamps()).toEqual({ f1: NOW, f2: NOW, f3: NOW + 1000, f4: 1 });
    expect((await db.folders.get("f3" as SidebarFolderId))?.items).toEqual([]);
  });
});

describe("BaseRepository rows without updatedAt", () => {
  it("a row type without updatedAt never gets the key", async () => {
    await db.tracks.bulkAdd([track("t1"), track("t2")]);

    await trackRepository.update("t1" as TrackId, { title: "New" });
    await trackRepository.updateMany([{ key: "t2" as TrackId, changes: { title: "New" } }]);

    const rows = await db.tracks.bulkGet(["t1", "t2"] as TrackId[]);
    expect(rows.map(row => row?.title)).toEqual(["New", "New"]);
    expect(rows[0]).not.toHaveProperty("updatedAt");
    expect(rows[1]).not.toHaveProperty("updatedAt");
  });
});
