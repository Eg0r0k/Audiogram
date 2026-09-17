import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import { ndAlbumId, ndArtistId, ndTrackId, ymTrackId } from "@/types/track-ref";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

//
// The one-time post-open migration over real Dexie (fake-indexeddb): pre-v16
// offline copies import as local tracks and the old "like = library
// membership" pins demote, once.
//

// `importFile` is what marks the adapter native (hasNativeSupport).
const storageMock = vi.hoisted(() => ({
  importFile: vi.fn(),
  getAppDataDir: vi.fn(async () => "C:/appdata"),
  getFileSize: vi.fn(),
  deleteFile: vi.fn(),
}));
const finalizeMock = vi.hoisted(() => ({ importDownloadedFile: vi.fn() }));
const searchMock = vi.hoisted(() => ({ rebuildSearchIndex: vi.fn(async () => {}) }));
const fsMock = vi.hoisted(() => ({ remove: vi.fn(async () => {}) }));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasFs: true } }));
vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("../service/finalize", () => finalizeMock);
vi.mock("@/modules/search/service/searchIndex", () => searchMock);
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  remove: fsMock.remove,
}));

import { db } from "@/db";
import { MIGRATION_FLAG, migrateOfflineCopies } from "../service/migrate-offline-copies";

const remoteTrack = (id: TrackId, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id,
  title: `T ${id}`,
  artistName: "Artist A",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.REMOTE_SUBSONIC,
  pinned: 1,
  state: TrackState.READY,
  storagePath: "",
  duration: 1,
  format: {},
  playCount: 2,
  likedAt: 5,
  addedAt: 1,
  ...overrides,
});

const copyRow = (trackId: TrackId, storagePath: string) => ({
  trackId,
  storagePath,
  sizeBytes: 10,
  format: {},
  downloadedAt: 1,
});

describe("migrateOfflineCopies (integration)", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));

    storageMock.getAppDataDir.mockResolvedValue("C:/appdata");
    storageMock.getFileSize.mockReturnValue(okAsync(10));
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    finalizeMock.importDownloadedFile.mockImplementation(async (remoteId: TrackId) => TrackId(`local-${remoteId}`));
  });

  it("imports every copy whose file exists, drains the table and deletes the old file", async () => {
    await db.tracks.bulkAdd([remoteTrack(ndTrackId("s1")), remoteTrack(ymTrackId("42"))]);
    await db.offlineCopies.bulkAdd([
      copyRow(ndTrackId("s1"), "offline/nd/s1.flac"),
      copyRow(ymTrackId("42"), "offline/ym/42.mp3"),
    ]);

    await migrateOfflineCopies();

    expect(finalizeMock.importDownloadedFile).toHaveBeenCalledWith(ndTrackId("s1"), "C:/appdata/offline/nd/s1.flac");
    expect(finalizeMock.importDownloadedFile).toHaveBeenCalledWith(ymTrackId("42"), "C:/appdata/offline/ym/42.mp3");
    expect(await db.offlineCopies.count()).toBe(0);
    expect(storageMock.deleteFile).toHaveBeenCalledWith("offline/nd/s1.flac");
    expect(storageMock.deleteFile).toHaveBeenCalledWith("offline/ym/42.mp3");
    expect(fsMock.remove).toHaveBeenCalledWith("offline", { baseDir: 1, recursive: true });
  });

  it("demotes remote pinned rows and the albums/artists left without pinned tracks, keeping likes and counts", async () => {
    await db.artists.add({ id: ndArtistId("a1"), name: "Artist A", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.albums.add({ id: ndAlbumId("al1"), title: "Remote Album", artistId: ndArtistId("a1"), pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.tracks.bulkAdd([
      remoteTrack(ndTrackId("s1"), { albumId: ndAlbumId("al1"), artistIds: [ndArtistId("a1")] }),
      remoteTrack(ymTrackId("liked")),
    ]);

    await migrateOfflineCopies();

    expect(await db.tracks.get(ndTrackId("s1"))).toMatchObject({ pinned: 0, likedAt: 5, playCount: 2 });
    expect((await db.tracks.get(ymTrackId("liked")))?.pinned).toBe(0);
    expect((await db.albums.get(ndAlbumId("al1")))?.pinned).toBe(0);
    expect((await db.artists.get(ndArtistId("a1")))?.pinned).toBe(0);
  });

  it("keeps a remote album/artist pinned while a pinned track still references it", async () => {
    await db.artists.add({ id: ndArtistId("a1"), name: "Artist A", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.albums.add({ id: ndAlbumId("al1"), title: "Remote Album", artistId: ndArtistId("a1"), pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.tracks.bulkAdd([
      remoteTrack(ndTrackId("s1"), { albumId: ndAlbumId("al1"), artistIds: [ndArtistId("a1")] }),
      remoteTrack(TrackId("local-s1"), {
        source: TrackSource.LOCAL_INTERNAL,
        storagePath: "tracks/local-s1.flac",
        sourceRef: ndTrackId("s1"),
        albumId: ndAlbumId("al1"),
        artistIds: [ndArtistId("a1")],
      }),
    ]);

    await migrateOfflineCopies();

    expect((await db.tracks.get(ndTrackId("s1")))?.pinned).toBe(0);
    expect((await db.tracks.get(TrackId("local-s1")))?.pinned).toBe(1);
    expect((await db.albums.get(ndAlbumId("al1")))?.pinned).toBe(1);
    expect((await db.artists.get(ndArtistId("a1")))?.pinned).toBe(1);
  });

  it("skips a copy whose file is gone and still drains its row", async () => {
    await db.tracks.add(remoteTrack(ndTrackId("gone")));
    await db.offlineCopies.add(copyRow(ndTrackId("gone"), "offline/nd/gone.flac"));
    storageMock.getFileSize.mockReturnValue(errAsync(new Error("missing")));

    await migrateOfflineCopies();

    expect(finalizeMock.importDownloadedFile).not.toHaveBeenCalled();
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
    expect(await db.offlineCopies.count()).toBe(0);
    // A missing file is nothing to lose: the folder still goes.
    expect(fsMock.remove).toHaveBeenCalled();
  });

  it("keeps the offline directory when an import failed", async () => {
    await db.tracks.add(remoteTrack(ndTrackId("bad")));
    await db.offlineCopies.add(copyRow(ndTrackId("bad"), "offline/nd/bad.flac"));
    finalizeMock.importDownloadedFile.mockRejectedValue(new Error("import failed"));

    await migrateOfflineCopies();

    expect(storageMock.deleteFile).not.toHaveBeenCalled();
    expect(fsMock.remove).not.toHaveBeenCalled();
    expect(await db.offlineCopies.count()).toBe(0);
  });

  it("leaves local rows alone", async () => {
    await db.tracks.add(remoteTrack(TrackId("local-x"), { source: TrackSource.LOCAL_INTERNAL, storagePath: "tracks/x.mp3" }));
    await db.artists.add({ id: ArtistId("ar-local"), name: "Local Artist", pinned: 1, addedAt: 1, updatedAt: 1 });
    await db.albums.add({ id: AlbumId("al-local"), title: "Local Album", artistId: ArtistId("ar-local"), pinned: 1, addedAt: 1, updatedAt: 1 });

    await migrateOfflineCopies();

    expect((await db.tracks.get(TrackId("local-x")))?.pinned).toBe(1);
    expect((await db.albums.get(AlbumId("al-local")))?.pinned).toBe(1);
    expect((await db.artists.get(ArtistId("ar-local")))?.pinned).toBe(1);
  });

  it("runs once: the localStorage flag stops a second run from demoting rows added later", async () => {
    await db.tracks.add(remoteTrack(ndTrackId("first")));

    await migrateOfflineCopies();
    expect((await db.tracks.get(ndTrackId("first")))?.pinned).toBe(0);

    await db.tracks.add(remoteTrack(ndTrackId("added-later")));
    await migrateOfflineCopies();

    expect((await db.tracks.get(ndTrackId("added-later")))?.pinned).toBe(1);
    expect(searchMock.rebuildSearchIndex).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the search index and sets the flag at the end", async () => {
    expect(localStorage.getItem(MIGRATION_FLAG)).toBeNull();

    await migrateOfflineCopies();

    expect(searchMock.rebuildSearchIndex).toHaveBeenCalled();
    expect(localStorage.getItem(MIGRATION_FLAG)).toBe("1");
  });
});
