import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok, okAsync } from "neverthrow";
import { TrackSource, TrackState, type TrackEntity } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";

const storageMock = vi.hoisted(() => ({ listFiles: vi.fn(), deleteFile: vi.fn() }));

vi.mock("@/db/storage", () => ({ storageService: storageMock }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => false }));

import { db } from "@/db";
import { clearLyricsData } from "../storage-info.service";

const track = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  storagePath: `tracks/${id}.mp3`,
  state: TrackState.READY,
  pinned: 1,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
  ...overrides,
});

describe("clearLyricsData", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.listFiles.mockResolvedValue(ok(["lyrics/t-1.lrc"]));
    storageMock.deleteFile.mockReturnValue(okAsync(undefined));
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("removes every lyrics field from the tracks along with the files", async () => {
    await db.tracks.bulkAdd([
      track("t-1", { lyricsPath: "lyrics/t-1.lrc", lyricsFileName: "Song.lrc", lyricsOffsetMs: 1500 }),
      track("t-2", { lyricsOffsetMs: -300 }),
    ]);

    await clearLyricsData();

    expect(storageMock.deleteFile).toHaveBeenCalledWith("lyrics/t-1.lrc");
    for (const row of await db.tracks.toArray()) {
      expect(row).not.toHaveProperty("lyricsPath");
      expect(row).not.toHaveProperty("lyricsFileName");
      expect(row).not.toHaveProperty("lyricsOffsetMs");
      expect(row.storagePath).toBe(`tracks/${row.id}.mp3`);
    }
  });
});
