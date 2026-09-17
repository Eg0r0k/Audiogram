import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { okAsync, ResultAsync } from "neverthrow";
import { ndAlbumId, ndArtistId, ndTrackId, ytTrackId } from "@/types/track-ref";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";
import type { ImportItem } from "@/services/types";
import type { SourceError, SourceTrackDTO } from "@/modules/sources/types";

//
// End-to-end (step 10): a whole album batch runs through the REAL finalizer
// into imported local tracks, and the persisted queue resumes after the
// manager module (worker state, p-limit, retry map) is recreated from
// scratch. Only the import engine is faked — it writes the local row the
// pipeline would have written.
//

const storageMock = vi.hoisted(() => ({
  importFile: vi.fn(),
  getFileSize: vi.fn(),
  deleteFile: vi.fn(),
  getAudioUrl: vi.fn(),
  warmup: vi.fn(async () => {}),
  getAppDataDir: vi.fn(async () => "C:/appdata"),
}));
const fsMock = vi.hoisted(() => ({
  readDir: vi.fn(async () => []),
  remove: vi.fn(async () => {}),
  stat: vi.fn(),
}));
const providerMock = vi.hoisted(() => ({
  getAlbum: vi.fn(),
  downloadToFile: vi.fn(),
  cancelDownload: vi.fn(),
}));
const engineMock = vi.hoisted(() => ({ importFromItems: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));
vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("@/modules/sources", () => ({
  sources: { get: () => providerMock, forTrack: () => providerMock },
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: 1 },
  readDir: fsMock.readDir,
  remove: fsMock.remove,
  stat: fsMock.stat,
}));
vi.mock("@/queries/library.queries", () => ({
  invalidateLibraryData: vi.fn(async () => {}),
}));
// The real engine would spin up the import worker pool.
vi.mock("@/services/importer.service", () => ({ musicLibraryEngine: engineMock }));

import { db } from "@/db";

function ndDto(rawId: string): SourceTrackDTO {
  return {
    id: ndTrackId(rawId),
    title: `Song ${rawId}`,
    albumTitle: "Remote Album",
    albumId: ndAlbumId("album1"),
    artistIds: [ndArtistId("artist1")],
    artistName: "Artist A",
  };
}

describe("downloads end-to-end", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // hasNativeSupport checks for importFile — the mock's shape passes.
    storageMock.importFile.mockImplementation((_src: string, target: string) => okAsync(target));
    storageMock.getFileSize.mockReturnValue(okAsync(2048));
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    engineMock.importFromItems.mockImplementation(async (items: ImportItem[]) => {
      const successful = [];
      for (const item of items) {
        const known = item.known!;
        const id = TrackId(`local-${known.sourceRef}`);
        await db.tracks.add({
          id,
          title: known.title,
          artistName: known.artistName ?? "",
          albumTitle: known.albumTitle ?? "",
          artistIds: [],
          albumId: AlbumId(""),
          tagIds: [],
          source: TrackSource.LOCAL_INTERNAL,
          pinned: 1,
          state: TrackState.READY,
          storagePath: `tracks/${id}.${item.ext}`,
          duration: 0,
          format: {},
          playCount: 0,
          addedAt: Date.now(),
          sourceRef: known.sourceRef,
        });
        successful.push({ trackId: id, fileName: item.name, title: known.title, artist: "", album: "" });
      }
      return { successful, failed: [], skipped: 0, total: items.length };
    });
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("downloads a whole album into imported local tracks through the real finalizer", async () => {
    const rawIds = ["s1", "s2", "s3"];
    providerMock.getAlbum.mockReturnValue(okAsync({
      album: { id: ndAlbumId("album1"), title: "Remote Album" },
      tracks: rawIds.map(ndDto),
    }));
    providerMock.downloadToFile.mockImplementation((trackId: string) =>
      okAsync({ path: `C:/tmp/downloads-tmp/${trackId.slice("nd:".length)}.flac`, format: { codec: "flac" } }));

    vi.resetModules();
    const { enqueueCollectionDownload } = await import("../service/enqueue");
    const { useDownloadsStore } = await import("../store/downloads.store");

    const batchId = await enqueueCollectionDownload("album", ndAlbumId("album1"));

    // Finished jobs are deleted; the imported rows below are the ledger.
    await vi.waitFor(async () => {
      expect(await db.downloadJobs.count()).toBe(0);
    });

    for (const rawId of rawIds) {
      const copy = await db.tracks.where("sourceRef").equals(ndTrackId(rawId)).first();
      expect(copy).toMatchObject({ source: "local_internal", pinned: 1, title: `Song ${rawId}` });
      // Download = import: the remote row stays a shadow.
      expect((await db.tracks.get(ndTrackId(rawId)))?.pinned).toBe(0);
    }
    expect(await db.offlineCopies.count()).toBe(0);

    const [items] = engineMock.importFromItems.mock.calls[0] as [ImportItem[]];
    expect(items[0]).toMatchObject({
      type: "native",
      path: "C:/tmp/downloads-tmp/s1.flac",
      ext: "flac",
      known: {
        sourceRef: ndTrackId("s1"),
        title: "Song s1",
        artistName: "Artist A",
        albumTitle: "Remote Album",
      },
    });
    expect(useDownloadsStore().batches[batchId!]).toMatchObject({ total: 3, finished: 3, failed: 0 });
  });

  it("downloads a single YT track through the shared manager (M5)", async () => {
    providerMock.downloadToFile.mockImplementation((trackId: string) =>
      okAsync({ path: `C:/yt-cache/${trackId.slice("yt:".length)}.m4a` }));

    vi.resetModules();
    const { downloadSubject } = await import("../service/enqueue");

    const dto: SourceTrackDTO = {
      id: ytTrackId("dQw4w9WgXcQ"),
      title: "Never Gonna Give You Up",
      artistName: "Rick Astley",
    };
    const jobId = await downloadSubject({ kind: "remote", dto });
    expect(jobId).not.toBeNull();

    await vi.waitFor(async () => {
      expect(await db.downloadJobs.count()).toBe(0);
    });

    expect(await db.tracks.where("sourceRef").equals(ytTrackId("dQw4w9WgXcQ")).count()).toBe(1);
    // Download = import: the yt row stays a shadow.
    expect((await db.tracks.get(ytTrackId("dQw4w9WgXcQ")))?.pinned).toBe(0);
    // The finalizer cleans the source temp file once the import landed.
    expect(fsMock.remove).toHaveBeenCalledWith("C:/yt-cache/dQw4w9WgXcQ.m4a");
  });

  it("resumes the persisted queue after the manager is recreated", async () => {
    // The finalizer imports with the shadow row's identity — without a row
    // there is nothing to download for.
    await db.tracks.bulkPut(["s1", "s2", "s3"].map(rawId => ({
      id: ndTrackId(rawId),
      title: `Song ${rawId}`,
      artistName: "Artist A",
      albumTitle: "Remote Album",
      artistIds: [],
      albumId: AlbumId(""),
      tagIds: [],
      source: TrackSource.REMOTE_SUBSONIC,
      pinned: 0 as const,
      state: TrackState.READY,
      storagePath: "",
      duration: 0,
      format: {},
      playCount: 0,
      addedAt: 1,
    })));

    // First life: downloads hang forever — two claim slots, one stays queued.
    providerMock.downloadToFile.mockImplementation(() =>
      ResultAsync.fromPromise(new Promise(() => {}), e => e as SourceError));

    vi.resetModules();
    const first = await import("../service/manager");
    await first.enqueueTrackDownload(ndTrackId("s1"));
    await first.enqueueTrackDownload(ndTrackId("s2"));
    await first.enqueueTrackDownload(ndTrackId("s3"));

    await vi.waitFor(async () => {
      const jobs = await db.downloadJobs.toArray();
      expect(jobs.filter(job => job.status === "running")).toHaveLength(2);
      expect(jobs.filter(job => job.status === "queued")).toHaveLength(1);
    });

    // Second life (app restart): fresh module state, downloads now succeed.
    providerMock.downloadToFile.mockImplementation((trackId: string) =>
      okAsync({ path: `C:/tmp/downloads-tmp/${trackId.slice("nd:".length)}.flac`, format: { codec: "flac" } }));
    vi.resetModules();
    const second = await import("../service/manager");
    await second.initDownloadManager();

    await vi.waitFor(async () => {
      expect(await db.downloadJobs.count()).toBe(0);
    });
    expect(await db.tracks.where("sourceRef").aboveOrEqual("").count()).toBe(3);
  });
});
