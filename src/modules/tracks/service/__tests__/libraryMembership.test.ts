import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistId, TrackId } from "@/types/ids";
import { ndAlbumId, ndArtistId, ndTrackId } from "@/types/track-ref";
import type { SourceTrackDTO } from "@/modules/sources";

const storage = vi.hoisted(() => ({ deleteFile: vi.fn() }));
vi.mock("@/db/storage", () => ({ storageService: storage }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) }));
vi.mock("../shadowAlbumCover", () => ({ ensureShadowCover: vi.fn(async () => {}) }));

const searchIndex = vi.hoisted(() => ({
  indexImportedTracks: vi.fn(async () => {}),
  removeSearchDocuments: vi.fn(async () => {}),
}));
vi.mock("@/modules/search/service/searchIndex", () => searchIndex);

import { db } from "@/db";
import { ensurePinned } from "../ensurePinned";
import { promoteTrackToLibrary, removeTrackFromLibrary } from "../libraryMembership";

const TRACK_ID = ndTrackId("song1");

const dto: SourceTrackDTO = {
  id: TRACK_ID,
  title: "Remote Song",
  artistName: "Artist A, Artist B",
  albumTitle: "Remote Album",
  albumId: ndAlbumId("album1"),
  artistIds: [ndArtistId("artist1"), ndArtistId("artist2")],
  duration: 240,
};

beforeEach(async () => {
  vi.clearAllMocks();
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
});

describe("promoteTrackToLibrary", () => {
  beforeEach(async () => {
    await ensurePinned({ kind: "remote", dto }, { pinned: 0 });
  });

  it("turns the shadow row into a library member with its album and artists", async () => {
    await promoteTrackToLibrary(TRACK_ID);

    expect((await db.tracks.get(TRACK_ID))?.pinned).toBe(1);
    expect((await db.albums.get(ndAlbumId("album1")))?.pinned).toBe(1);
    expect((await db.artists.bulkGet([ndArtistId("artist1"), ndArtistId("artist2")])).map(a => a?.name))
      .toEqual(["Artist A", "Artist B"]);
  });

  it("mirrors the promoted track into the search index", async () => {
    await promoteTrackToLibrary(TRACK_ID);

    expect(searchIndex.indexImportedTracks).toHaveBeenCalledWith([TRACK_ID]);
  });

  it("throws when the track does not exist", async () => {
    await expect(promoteTrackToLibrary(ndTrackId("missing"))).rejects.toThrow(/Track not found/);
  });
});

describe("removeTrackFromLibrary", () => {
  beforeEach(async () => {
    await ensurePinned({ kind: "remote", dto });
    await db.tracks.update(TRACK_ID, { likedAt: 5 });
    await db.playlists.bulkPut([
      { id: PlaylistId("p1"), name: "P1", trackIds: [TRACK_ID, TrackId("other")], addedAt: 1, updatedAt: 1 },
      { id: PlaylistId("p2"), name: "P2", trackIds: [TrackId("other")], addedAt: 1, updatedAt: 1 },
    ]);
    vi.clearAllMocks();
  });

  const pinSibling = () =>
    ensurePinned({ kind: "remote", dto: { ...dto, id: ndTrackId("song2"), title: "Second" } });

  it("degrades the row to shadow and cascades playlists/like", async () => {
    await removeTrackFromLibrary(TRACK_ID);

    const row = await db.tracks.get(TRACK_ID);
    expect(row?.pinned).toBe(0);
    expect(row?.likedAt).toBeUndefined();
    expect((await db.playlists.get(PlaylistId("p1")))?.trackIds).toEqual([TrackId("other")]);
    expect((await db.playlists.get(PlaylistId("p2")))?.trackIds).toEqual([TrackId("other")]);
  });

  it("does not touch files when removing a remote row from the library", async () => {
    await removeTrackFromLibrary(TRACK_ID);

    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it("deletes the album/artist rows when no library tracks remain", async () => {
    await removeTrackFromLibrary(TRACK_ID);

    expect(await db.albums.count()).toBe(0);
    expect(await db.artists.count()).toBe(0);
  });

  it("keeps album/artist rows while other library tracks remain", async () => {
    await pinSibling();

    await removeTrackFromLibrary(TRACK_ID);

    expect(await db.albums.get(ndAlbumId("album1"))).toBeDefined();
    expect(await db.artists.count()).toBe(2);
  });

  it("de-indexes the track and every deleted album/artist", async () => {
    await removeTrackFromLibrary(TRACK_ID);

    expect(searchIndex.removeSearchDocuments).toHaveBeenCalledWith([
      `track:${TRACK_ID}`,
      `album:${ndAlbumId("album1")}`,
      `artist:${ndArtistId("artist1")}`,
      `artist:${ndArtistId("artist2")}`,
    ]);
  });

  it("de-indexes only the track while the album/artist stay", async () => {
    await pinSibling();

    await removeTrackFromLibrary(TRACK_ID);

    expect(searchIndex.removeSearchDocuments).toHaveBeenCalledWith([`track:${TRACK_ID}`]);
  });
});
