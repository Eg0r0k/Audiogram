import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  TrackSource,
  TrackState,
  type AlbumEntity,
  type ArtistEntity,
  type PlaylistEntity,
  type TrackEntity,
} from "@/db/entities";
import type { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";
import type { SearchFilter } from "../types";
import { initSearchIndex, resetSearchIndex, searchDocuments, syncSearchIndex } from "../searchIndex";

const AR1 = "ar1" as ArtistId;
const AL1 = "al1" as AlbumId;
const T1 = "t1" as TrackId;
const P1 = "p1" as PlaylistId;

const artist = (overrides: Partial<ArtistEntity> = {}): ArtistEntity => ({
  id: AR1,
  name: "Portishead",
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const album = (overrides: Partial<AlbumEntity> = {}): AlbumEntity => ({
  id: AL1,
  title: "Dummy",
  artistId: AR1,
  year: 1994,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const track = (overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: T1,
  title: "Glory Box",
  artistName: "Stale Caption",
  albumTitle: "Stale Album",
  artistIds: [AR1],
  albumId: AL1,
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: "tracks/t1.mp3",
  duration: 300,
  format: {},
  playCount: 0,
  addedAt: 1,
  ...overrides,
});

const playlist = (overrides: Partial<PlaylistEntity> = {}): PlaylistEntity => ({
  id: P1,
  name: "Road Trip",
  trackIds: [],
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const hits = async (query: string, filter: SearchFilter) => (await searchDocuments(query, filter)).results;

const seedFamily = async () => {
  await db.artists.add(artist());
  await db.albums.add(album());
  await db.tracks.add(track());
};

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
  resetSearchIndex();
  // Built over an empty database, so only a sync can put rows into it.
  await initSearchIndex();
});

describe("syncSearchIndex", () => {
  it("indexes a library track with the names of its artist and album rows", async () => {
    await seedFamily();

    await syncSearchIndex({ tracks: [T1] });

    expect(await hits("glory box", "track")).toEqual([
      expect.objectContaining({ entityId: T1, artist: "Portishead", album: "Dummy" }),
    ]);
  });

  it("drops a track once its row is gone", async () => {
    await seedFamily();
    await syncSearchIndex({ tracks: [T1] });
    expect(await hits("glory box", "track")).toHaveLength(1);

    await db.tracks.delete(T1);
    await syncSearchIndex({ tracks: [T1] });

    expect(await hits("glory box", "track")).toEqual([]);
  });

  it("drops a track once it leaves the library", async () => {
    await seedFamily();
    await syncSearchIndex({ tracks: [T1] });
    expect(await hits("glory box", "track")).toHaveLength(1);

    await db.tracks.update(T1, { pinned: 0 });
    await syncSearchIndex({ tracks: [T1] });

    expect(await hits("glory box", "track")).toEqual([]);
  });

  it("refreshes the artist and album of a synced track", async () => {
    await seedFamily();
    await syncSearchIndex({ tracks: [T1] });

    await db.artists.update(AR1, { name: "Beth Gibbons" });
    await db.albums.update(AL1, { title: "Third" });
    await syncSearchIndex({ tracks: [T1] });

    expect(await hits("beth gibbons", "artist")).toEqual([expect.objectContaining({ entityId: AR1 })]);
    expect(await hits("portishead", "artist")).toEqual([]);
    expect(await hits("third", "album")).toEqual([
      expect.objectContaining({ entityId: AL1, artist: "Beth Gibbons" }),
    ]);
    expect(await hits("glory box", "track")).toEqual([
      expect.objectContaining({ entityId: T1, artist: "Beth Gibbons", album: "Third" }),
    ]);
  });

  it("drops an album once its row is deleted", async () => {
    await db.artists.add(artist());
    await db.albums.add(album());
    await syncSearchIndex({ albums: [AL1] });
    expect(await hits("dummy", "album")).toEqual([expect.objectContaining({ entityId: AL1, artist: "Portishead" })]);

    await db.albums.delete(AL1);
    await syncSearchIndex({ albums: [AL1] });

    expect(await hits("dummy", "album")).toEqual([]);
  });

  it("never indexes an artist or album outside the library", async () => {
    await db.artists.add(artist({ pinned: 0 }));
    await db.albums.add(album({ pinned: 0 }));
    await db.tracks.add(track());

    await syncSearchIndex({ tracks: [T1], albums: [AL1], artists: [AR1] });

    expect(await hits("portishead", "artist")).toEqual([]);
    expect(await hits("dummy", "album")).toEqual([]);
    expect(await hits("glory box", "track")).toEqual([
      expect.objectContaining({ entityId: T1, artist: "Portishead", album: "Dummy" }),
    ]);
  });

  it("indexes a playlist without a membership check", async () => {
    await db.playlists.add(playlist());

    await syncSearchIndex({ playlists: [P1] });

    expect(await hits("road trip", "playlist")).toEqual([expect.objectContaining({ entityId: P1 })]);
  });
});
