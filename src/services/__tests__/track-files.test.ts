import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import type { TrackEntity } from "@/db/entities";
import { TrackSource } from "@/db/entities";
import { StorageError } from "@/db/errors/storage.errors";
import { TrackId } from "@/types/ids";

const storageMock = vi.hoisted(() => ({ deleteFile: vi.fn() }));
const logger = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

import { db } from "@/db";
import { deleteOwnedFiles, deleteOwnedLyricsFile } from "../track-files";

const row = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistIds: [],
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: `tracks/${id}.mp3`,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
  albumTitle: "",
  artistName: "",
  ...overrides,
} as unknown as TrackEntity);

const deleted = () => storageMock.deleteFile.mock.calls.map(([path]) => path as string).sort();

describe("deleteOwnedFiles", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("deletes the imported audio and the attached lyrics", async () => {
    await deleteOwnedFiles([row("t-1", { lyricsPath: "lyrics/t-1.lrc" }), row("t-2")]);

    expect(deleted()).toEqual(["lyrics/t-1.lrc", "tracks/t-1.mp3", "tracks/t-2.mp3"]);
  });

  it("leaves a watched folder's file to the user but drops the lyrics Audiogram attached", async () => {
    await deleteOwnedFiles([row("t-1", {
      source: TrackSource.LOCAL_EXTERNAL,
      storagePath: "D:/Music/song.mp3",
      lyricsPath: "lyrics/t-1.lrc",
    })]);

    expect(deleted()).toEqual(["lyrics/t-1.lrc"]);
  });

  it("has nothing to delete for a remote row", async () => {
    await deleteOwnedFiles([row("ym:1", { source: TrackSource.REMOTE_YM, storagePath: "" })]);

    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("keeps a file another row still points at", async () => {
    await db.tracks.put(row("t-2", { storagePath: "tracks/shared.mp3" }));

    await deleteOwnedFiles([row("t-1", { storagePath: "tracks/shared.mp3" })]);

    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });

  it("logs a file it could not delete and goes on with the rest", async () => {
    storageMock.deleteFile.mockReturnValueOnce(errAsync(StorageError.deleteFailed("tracks/t-1.mp3", new Error("busy"))));

    await expect(deleteOwnedFiles([row("t-1"), row("t-2")])).resolves.toBeUndefined();

    expect(deleted()).toEqual(["tracks/t-1.mp3", "tracks/t-2.mp3"]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe("deleteOwnedLyricsFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
  });

  it("deletes an owned lyrics file and ignores paths outside the lyrics folder", async () => {
    await deleteOwnedLyricsFile("lyrics/t-1.lrc");
    await deleteOwnedLyricsFile("D:/Music/song.lrc");
    await deleteOwnedLyricsFile("tracks/t-1.mp3");

    expect(deleted()).toEqual(["lyrics/t-1.lrc"]);

    storageMock.deleteFile.mockReturnValueOnce(errAsync(StorageError.deleteFailed("lyrics/t-2.lrc", new Error("busy"))));

    await expect(deleteOwnedLyricsFile("lyrics/t-2.lrc")).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
