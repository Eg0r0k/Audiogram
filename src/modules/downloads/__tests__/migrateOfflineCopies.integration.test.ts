import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import { ndAlbumId, ndArtistId, ndTrackId, ymTrackId } from "@/types/track-ref";
import type { TrackEntity } from "@/db/entities";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

//
// The post-open half of the v16 upgrade over real Dexie (fake-indexeddb):
// pre-v16 offline copies import as local tracks; the table is the state.
//

// `importFile` is what marks the adapter native (hasNativeSupport).
const storageMock = vi.hoisted(() => ({
  importFile: vi.fn(),
  getAppDataDir: vi.fn(async () => "C:/appdata"),
  getFileSize: vi.fn(),
  deleteFile: vi.fn(),
}));
const finalizeMock = vi.hoisted(() => ({ importDownloadedFile: vi.fn() }));
const fsMock = vi.hoisted(() => ({ remove: vi.fn(async () => {}) }));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/environment/platformCaps", () => ({ platformCaps: { hasFs: true } }));
vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("../service/finalize", () => finalizeMock);
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  remove: fsMock.remove,
}));

import { db } from "@/db";
import { migrateOfflineCopies } from "../service/migrate-offline-copies";

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

  it("does nothing when the table is empty", async () => {
    await migrateOfflineCopies();

    expect(finalizeMock.importDownloadedFile).not.toHaveBeenCalled();
    expect(storageMock.getAppDataDir).not.toHaveBeenCalled();
  });

  it("handles rows a previous launch left behind", async () => {
    await db.tracks.add(remoteTrack(ndTrackId("s1")));
    await db.offlineCopies.add(copyRow(ndTrackId("s1"), "offline/nd/s1.flac"));
    finalizeMock.importDownloadedFile.mockRejectedValueOnce(new Error("boom"));
    await migrateOfflineCopies();
    expect(await db.offlineCopies.count()).toBe(0);

    await db.offlineCopies.add(copyRow(ndTrackId("s2"), "offline/nd/s2.flac"));
    await db.tracks.add(remoteTrack(ndTrackId("s2")));
    await migrateOfflineCopies();

    expect(finalizeMock.importDownloadedFile).toHaveBeenLastCalledWith(ndTrackId("s2"), "C:/appdata/offline/nd/s2.flac");
    expect(await db.offlineCopies.count()).toBe(0);
  });
});
