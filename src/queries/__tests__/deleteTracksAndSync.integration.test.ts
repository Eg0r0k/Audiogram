import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { okAsync } from "neverthrow";
import type { AlbumEntity, ArtistEntity, PlaylistEntity, TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, ArtistId, PlaylistId, TrackId } from "@/types/ids";

const storageMock = vi.hoisted(() => ({ deleteFile: vi.fn() }));
const searchMock = vi.hoisted(() => ({ syncSearchIndex: vi.fn(async () => {}) }));

vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/services/search/searchIndex", () => ({
  syncSearchIndex: searchMock.syncSearchIndex,
  searchTracks: vi.fn(),
  searchDocuments: vi.fn(),
}));

import { db } from "@/db";
import { deleteTracksAndSync } from "../track.queries";

const artistId = ArtistId("a-1");
const albumId = AlbumId("al-1");
const playlistId = PlaylistId("pl-1");

const artist: ArtistEntity = { id: artistId, name: "Local", addedAt: 1, updatedAt: 1 } as ArtistEntity;
const album: AlbumEntity = { id: albumId, title: "Local Album", artistId, addedAt: 1, updatedAt: 1 } as AlbumEntity;

const localTrack = (id: string, title: string): TrackEntity => ({
  id: TrackId(id),
  title,
  artistIds: [artistId],
  albumId,
  tagIds: [],
  source: TrackSource.LOCAL,
  state: TrackState.READY,
  storagePath: `tracks/${id}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
  albumTitle: "Local Album",
  artistName: "Local",
} as unknown as TrackEntity);

describe("deleteTracksAndSync (integration)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.artists.put(artist);
    await db.albums.put(album);
    await db.tracks.bulkPut([localTrack("t-1", "One"), localTrack("t-2", "Two"), localTrack("t-3", "Three")]);
    await db.playlists.put({
      id: playlistId,
      name: "Mix",
      trackIds: [TrackId("t-1"), TrackId("t-3")],
      addedAt: 1,
      updatedAt: 1,
    } satisfies PlaylistEntity);
  });

  it("removes rows and playlist refs for all ids, keeps the rest", async () => {
    const deleted = await deleteTracksAndSync([TrackId("t-1"), TrackId("t-2")]);

    expect(deleted).toBe(2);
    expect((await db.tracks.toArray()).map(t => t.id)).toEqual([TrackId("t-3")]);
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
    expect((await db.playlists.get(playlistId))?.trackIds).toEqual([TrackId("t-3")]);
    expect(await db.albums.count()).toBe(1);
    expect(await db.artists.count()).toBe(1);
  });

  it("syncs the search index once with every deleted id", async () => {
    await deleteTracksAndSync([TrackId("t-1"), TrackId("t-2")]);

    expect(searchMock.syncSearchIndex).toHaveBeenCalledTimes(1);
    expect(searchMock.syncSearchIndex).toHaveBeenCalledWith({ tracks: [TrackId("t-1"), TrackId("t-2")] });
  });

  it("GC takes the album and artist when their last tracks go", async () => {
    await deleteTracksAndSync([TrackId("t-1"), TrackId("t-2"), TrackId("t-3")]);

    expect(await db.tracks.count()).toBe(0);
    expect(await db.albums.count()).toBe(0);
    expect(await db.artists.count()).toBe(0);
  });

  it("ignores unknown ids and returns 0 for an empty list", async () => {
    expect(await deleteTracksAndSync([])).toBe(0);
    expect(await deleteTracksAndSync([TrackId("nope")])).toBe(0);
    expect(await db.tracks.count()).toBe(3);
  });
});
